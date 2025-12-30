import { useRequest } from "ahooks";
import { PlusOutlined } from "@ant-design/icons";
import { Image, Upload, Flex, Button, Space } from "antd";
import { useCallback, useEffect, useState, useRef } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { getBIS, setBIS } from "~storage/local";
import type { BeforeUpload } from "~interface";
import type { ThumbnailAcceptData, ThumbnailResponseData } from "~workers/thumbnailType";

interface DisplayedImage {
  id: number;
  thumbnailUrl: string;
}

interface BackgroundProps {
  reloadBackground?: () => void;
}

export function Background(props: BackgroundProps) {
  const { reloadBackground } = props;
  const [thumbnail, setThumbnail] = useState<DisplayedImage>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const currentImageObjectUrlRef = useRef<string>();
  const currentThumbnailObjectUrlRef = useRef<string>();

  const { data: bis, loading: bisLoading, refresh: reloadBIS } = useRequest(getBIS);

  const { refresh } = useRequest(() => imageDb.images.orderBy("id").limit(1).keys(), {
    onBefore: () => {
      if (currentThumbnailObjectUrlRef.current) {
        URL.revokeObjectURL(currentThumbnailObjectUrlRef.current);
      }
    },
    onSuccess: async (data) => {
      if (Array.isArray(data) && data?.length === 1 && typeof data[0] === "number") {
        const imageId = data[0];
        const thumbnailResult = await imageDb.thumbnails.get(imageId);
        let temp;
        if (thumbnailResult) {
          const url = URL.createObjectURL(thumbnailResult.thumbnail);
          currentThumbnailObjectUrlRef.current = url;
          temp = { id: thumbnailResult.id, thumbnailUrl: url };
        } else {
          temp = { id: imageId, thumbnailUrl: defaultThumbnailUrl };
        }
        setThumbnail(temp);
        return;
      }
      setThumbnail(undefined);
    }
  });

  const handleOpenChange = async (visible: boolean) => {
    if (currentImageObjectUrlRef.current) {
      URL.revokeObjectURL(currentImageObjectUrlRef.current);
      currentImageObjectUrlRef.current = undefined;
    }
    if (visible && thumbnail?.id) {
      const imageId = thumbnail?.id;
      const imageRecord = await imageDb.images.get(imageId);
      if (imageRecord?.file) {
        const imageUrl = URL.createObjectURL(imageRecord.file);
        setImagePreviewUrl(imageUrl);
        currentImageObjectUrlRef.current = imageUrl;
      } else {
        console.warn("Original image file not found for id:", imageId, "Falling back to thumbnail for preview.");
      }
      return;
    }
    setImagePreviewUrl(undefined);
  };

  const beforeUpload = useCallback<BeforeUpload>(
    (file) => {
      return new Promise((resolve) => {
        const worker = new Worker(new URL("../workers/thumbnail.ts", import.meta.url), { type: "module" });

        worker.onmessage = async (e: MessageEvent<ThumbnailResponseData>) => {
          refresh();
          await setBIS(true);
          reloadBackground?.();
          resolve(Upload.LIST_IGNORE);
          reloadBIS();
          worker.terminate();
        };

        worker.onerror = (error) => {
          console.error("Thumbnail worker error:", error?.message);
          resolve(Upload.LIST_IGNORE);
          worker.terminate();
        };

        const data: ThumbnailAcceptData = { file };
        worker.postMessage(data);
      });
    },
    []
  );

  const handleDownloadSpecificImage = async (imageId: number) => {
    const imageRecord = await imageDb.images.get(imageId);
    if (imageRecord?.file) {
      downloadFile(imageRecord.file, imageRecord.file?.name || `image-${imageRecord.id}`);
    } else {
      console.error("Original file not found for download:", imageId);
    }
  };

  const handleDownload = async () => {
    if (thumbnail?.id) {
      const imageId = thumbnail?.id;
      await handleDownloadSpecificImage(imageId);
    }
  };

  const handleDelete = async () => {
    if (thumbnail?.id) {
      const imageId = thumbnail?.id;
      await imageDb.images.delete(imageId);
      await imageDb.thumbnails.delete(imageId);
      refresh();
      const biSwitch = await getBIS();
      if (biSwitch) {
        setBIS(false);
        reloadBackground?.();
      }
    }
  };

  const setChange = useCallback(() => {
    if (!bis && thumbnail?.id) {
      setBIS(true);
      reloadBackground?.();
      reloadBIS();
    }
    if (bis) {
      setBIS(false);
      reloadBackground?.();
      reloadBIS();
    }
  }, [bis, thumbnail]);

  useEffect(
    () => () => {
      if (currentThumbnailObjectUrlRef.current) {
        URL.revokeObjectURL(currentThumbnailObjectUrlRef.current);
      }
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    },
    []
  );

  return (
    <>
      <Flex vertical gap="middle">
        {thumbnail ? (
          <Flex wrap="wrap" gap="middle">
            <Image
              src={thumbnail?.thumbnailUrl}
              width={102}
              height={102}
              preview={{
                onOpenChange: handleOpenChange,
                src: imagePreviewUrl
              }}
            />
            <Flex vertical gap="middle">
              <Space size="middle">
                <Button onClick={handleDownload}>下载</Button>
                <Button onClick={setChange} loading={bisLoading}>
                  {bis ? "取消当前图片" : "设置当前图片"}
                </Button>
              </Space>
              <div>
                <Button onClick={handleDelete}>删除</Button>
              </div>
            </Flex>
          </Flex>
        ) : null}
        <div>
          <Upload accept="image/*," beforeUpload={beforeUpload} listType="picture-card">
            <button style={{ border: 0, background: "none" }} type="button">
              <PlusOutlined />
              <div style={{ marginTop: 8 }}>{!thumbnail ? "选择本地图片" : "替换当前图片"}</div>
            </button>
          </Upload>
        </div>
      </Flex>
    </>
  );
}

type Obj = Parameters<typeof URL.createObjectURL>[0];

function downloadFile(obj: Obj, fileName: string) {
  const downloadUrl = URL.createObjectURL(obj);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  link.click();
  // 清理临时 URL
  window.URL.revokeObjectURL(downloadUrl);
}

const defaultThumbnailUrl =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgc3R5bGU9ImZpbGw6I2VlZTtzdHJva2U6I2NjYztzdHJva2Utd2lkdGg6MSIgLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTJweCIgZmlsbD0iIzgwODA4MCI+Tm8gVGh1bWI8L3RleHQ+PC9zdmc+Cg==";
