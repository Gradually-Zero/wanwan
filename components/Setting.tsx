import { PlusOutlined } from "@ant-design/icons";
import { Image, Upload, Flex, Button } from "antd";
import { useCallback, useEffect, useState, useRef } from "react";
import { setBGIId } from "~storage/local";
import { imageDb } from "~indexedDB/ImageDB";
import type { BeforeUpload } from "~interface";
import type { ThumbnailAcceptData, ThumbnailResponseData } from "~workers/thumbnailType";

interface DisplayedImage {
  id: number;
  thumbnailUrl: string;
}

interface SettingProps {
  backgroundImageId?: number | null;
}

export function Setting(props: SettingProps) {
  const { backgroundImageId } = props;
  const [imageTotal, setImageTotal] = useState<number>();
  const [thumbnail, setThumbnail] = useState<DisplayedImage>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const currentImageObjectUrlRef = useRef<string>();
  const currentThumbnailObjectUrlRef = useRef<string>();

  const fetchThumbnails = useCallback(async () => {
    try {
      const imageTotal = await imageDb.images.count();
      setImageTotal(imageTotal);
      const imageIds = (await imageDb.images
        .orderBy("id") // 使用 id 索引排序
        .limit(1) // 限制返回的记录数
        .keys()) as number[]; // 仅获取主键（id），不加载图片数据
      if (imageIds.length === 1) {
        const imageId = imageIds[0];
        const thumbnailResult = await imageDb.thumbnails.get(imageId);
        if (currentThumbnailObjectUrlRef.current) {
          URL.revokeObjectURL(currentThumbnailObjectUrlRef.current);
        }
        let temp;
        if (thumbnailResult) {
          const url = URL.createObjectURL(thumbnailResult.thumbnail);
          currentThumbnailObjectUrlRef.current = url;
          temp = { id: thumbnailResult.id, thumbnailUrl: url };
        } else {
          temp = { id: imageId, thumbnailUrl: defaultThumbnailUrl };
        }
        setThumbnail(temp);
      } else {
        setThumbnail(undefined);
      }
    } catch (err) {
      console.error("Error fetching thumbnails from IndexedDB:", err);
      if (currentThumbnailObjectUrlRef.current) {
        URL.revokeObjectURL(currentThumbnailObjectUrlRef.current);
      }
      currentThumbnailObjectUrlRef.current = undefined;
      setThumbnail(undefined);
    }
  }, []);

  useEffect(() => {
    fetchThumbnails();
    return () => {
      if (currentThumbnailObjectUrlRef.current) {
        URL.revokeObjectURL(currentThumbnailObjectUrlRef.current);
      }
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    };
  }, [fetchThumbnails]);

  const handleVisibleChange = async (visible: boolean) => {
    if (visible && thumbnail?.id) {
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
        currentImageObjectUrlRef.current = undefined;
      }
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
    if (currentImageObjectUrlRef.current) {
      URL.revokeObjectURL(currentImageObjectUrlRef.current);
      currentImageObjectUrlRef.current = undefined;
    }
    setImagePreviewUrl(undefined);
  };

  const beforeUpload = useCallback<BeforeUpload>(
    (file) => {
      return new Promise((resolve) => {
        const worker = new Worker(new URL("../workers/thumbnail.ts", import.meta.url), { type: "module" });

        worker.onmessage = async (e: MessageEvent<ThumbnailResponseData>) => {
          const { id } = e.data;
          setBGIId(id);
          fetchThumbnails();
          resolve(Upload.LIST_IGNORE);
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
    [fetchThumbnails]
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
      if (backgroundImageId === imageId) {
        setBGIId(null);
      }
      fetchThumbnails();
    }
  };

  const handleSet = () => {
    if (thumbnail?.id) {
      const imageId = thumbnail?.id;
      setBGIId(imageId);
    }
  };

  const handleUnset = () => {
    setBGIId(null);
  };

  return (
    <>
      <Flex wrap="wrap" gap="middle">
        {thumbnail ? (
          <Image
            src={thumbnail?.thumbnailUrl}
            width={102}
            height={102}
            preview={{
              onVisibleChange: handleVisibleChange,
              src: imagePreviewUrl
            }}
          />
        ) : null}
        <Upload accept="image/*," beforeUpload={beforeUpload} listType="picture-card">
          <button style={{ border: 0, background: "none" }} type="button">
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>{imageTotal === 0 ? "选择本地图片" : "替换当前图片"}</div>
          </button>
        </Upload>
        <Flex gap="small">
          <Button onClick={handleDownload}>下载</Button>
          <Button onClick={handleDelete}>删除</Button>
          <Button onClick={handleSet}>设置</Button>
          <Button onClick={handleUnset}>取消</Button>
        </Flex>
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
