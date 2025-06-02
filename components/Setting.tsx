import {
  EyeOutlined,
  PlusOutlined,
  LeftOutlined,
  UndoOutlined,
  RightOutlined,
  ZoomInOutlined,
  DeleteOutlined,
  ZoomOutOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from "@ant-design/icons";
import { Image, Upload, Flex, Space } from "antd";
import { useCallback, useEffect, useState, useRef } from "react";
import { setBGIId } from "~storage/local";
import { imageDb } from "~indexedDB/ImageDB";
import type { BeforeUpload } from "~interface";
import type { ThumbnailAcceptData, ThumbnailResponseData } from "~workers/thumbnailType";
import * as lessStyle from "./Setting.module.less";

interface DisplayedImage {
  id: number;
  thumbnailUrl: string;
}

interface SettingProps {
  backgroundImageId?: number | null;
}

export function Setting(props: SettingProps) {
  const { backgroundImageId } = props;
  const [previewVisible, setPreviewVisible] = useState(false);
  const [displayedImages, setDisplayedThumbnails] = useState<DisplayedImage[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [activePreviewOriginalUrl, setActivePreviewOriginalUrl] = useState<string | undefined>(undefined);
  const [isOriginalLoading, setIsOriginalLoading] = useState(false);
  const currentThumbnailObjectUrlsRef = useRef<string[]>([]);
  const currentOriginalObjectUrlRef = useRef<string | undefined>(undefined);

  const fetchThumbnails = useCallback(async () => {
    try {
      // 对之前创建的 Object URL 进行一次性释放
      currentThumbnailObjectUrlsRef.current.forEach(URL.revokeObjectURL);
      // 重置 objectUrls
      const objectUrls: string[] = [];
      const newDisplayedImages: DisplayedImage[] = [];
      const offset = 0;
      const limit = 10;
      const imageTotal = await imageDb.images.count();
      const imageIds = await imageDb.images
        .orderBy("id") // 使用 id 索引排序
        .offset(offset) // 跳过指定数量的记录
        .limit(limit) // 限制返回的记录数
        .keys(); // 仅获取主键（id），不加载图片数据
      const numberIds = imageIds.filter((id) => typeof id === "number");
      const thumbnailResult = await imageDb.thumbnails.bulkGet(numberIds);
      const thumbnails = thumbnailResult.map((item, index) => {
        if (item === undefined) {
          const temp = { id: numberIds[index], thumbnail: undefined };
          return temp;
        }
        return item;
      });

      thumbnails.forEach((item) => {
        const id = item.id;
        const thumbnail = item?.thumbnail;
        if (thumbnail) {
          const url = URL.createObjectURL(thumbnail);
          newDisplayedImages.push({ id, thumbnailUrl: url });
          // 只有真实的 Object URL 才需要跟踪释放
          objectUrls.push(url);
        } else {
          newDisplayedImages.push({ id, thumbnailUrl: defaultThumbnailUrl });
        }
      });
      setDisplayedThumbnails(newDisplayedImages);
      // 只存储需要释放的 Object URL
      currentThumbnailObjectUrlsRef.current = objectUrls;
    } catch (err) {
      console.error("Error fetching thumbnails from IndexedDB:", err);
      currentThumbnailObjectUrlsRef.current.forEach(URL.revokeObjectURL);
      currentThumbnailObjectUrlsRef.current = [];
      setDisplayedThumbnails([]);
    }
  }, [currentThumbnailObjectUrlsRef, setDisplayedThumbnails]);

  useEffect(() => {
    fetchThumbnails();
    return () => {
      currentThumbnailObjectUrlsRef.current.forEach(URL.revokeObjectURL);
      if (currentOriginalObjectUrlRef.current) {
        URL.revokeObjectURL(currentOriginalObjectUrlRef.current);
      }
    };
  }, [fetchThumbnails]);

  useEffect(() => {
    if (previewVisible && displayedImages.length > 0 && activePreviewIndex < displayedImages.length) {
      const loadImage = async () => {
        if (currentOriginalObjectUrlRef.current) {
          URL.revokeObjectURL(currentOriginalObjectUrlRef.current);
          currentOriginalObjectUrlRef.current = undefined;
          setActivePreviewOriginalUrl(undefined);
        }

        setIsOriginalLoading(true);
        try {
          const currentImageId = displayedImages[activePreviewIndex]?.id;
          if (currentImageId === undefined) {
            console.error("No image at active index:", activePreviewIndex);
            setIsOriginalLoading(false);
            return;
          }
          const imageRecord = await imageDb.images.get(currentImageId);
          if (imageRecord?.file) {
            const originalUrl = URL.createObjectURL(imageRecord.file);
            setActivePreviewOriginalUrl(originalUrl);
            currentOriginalObjectUrlRef.current = originalUrl;
          } else {
            console.warn("Original image file not found for id:", currentImageId, "Falling back to thumbnail for preview.");
            // 如果原始图片文件未找到或 imageRecord 未定义，则回退到使用缩略图进行预览
            setActivePreviewOriginalUrl(displayedImages[activePreviewIndex]?.thumbnailUrl);
          }
        } catch (error) {
          console.error("Error loading original image:", error);
          // 出现错误时回退到使用缩略图
          setActivePreviewOriginalUrl(displayedImages[activePreviewIndex]?.thumbnailUrl);
        } finally {
          setIsOriginalLoading(false);
        }
      };
      loadImage();
    } else {
      // 预览关闭时进行清理
      if (currentOriginalObjectUrlRef.current) {
        URL.revokeObjectURL(currentOriginalObjectUrlRef.current);
        currentOriginalObjectUrlRef.current = undefined;
        setActivePreviewOriginalUrl(undefined);
      }
      setIsOriginalLoading(false);
    }
  }, [previewVisible, activePreviewIndex, displayedImages]);

  const handleVisibleChange = (visible: boolean) => {
    setPreviewVisible(visible);
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
    if (displayedImages.length > 0 && activePreviewIndex >= 0) {
      const imageId = displayedImages?.[activePreviewIndex]?.id;
      await handleDownloadSpecificImage(imageId);
    }
  };

  const handleDeleteSpecificImage = async (imageId: number) => {
    await imageDb.images.delete(imageId);
    await imageDb.thumbnails.delete(imageId);
    if (backgroundImageId === imageId) {
      const firstImage = await imageDb.images.orderBy(":id").first();
      setBGIId(firstImage?.id ?? 0);
    }
    fetchThumbnails();
  };

  return (
    <>
      <Flex wrap="wrap" gap="middle">
        <Upload accept="image/*," beforeUpload={beforeUpload} listType="picture-card">
          <button style={{ border: 0, background: "none" }} type="button">
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>Upload</div>
          </button>
        </Upload>
        <Image.PreviewGroup
          items={displayedImages.map((image) => image.thumbnailUrl)} // 用于控制工具栏中的图片数量
          preview={{
            visible: previewVisible,
            src: activePreviewOriginalUrl, // 动态设置预览的 src
            current: activePreviewIndex,
            onChange: (current) => setActivePreviewIndex(current),
            onVisibleChange: handleVisibleChange,
            toolbarRender: (_, { transform: { scale }, actions: { onActive, onZoomOut, onZoomIn, onReset } }) => (
              <Space size={12} className={lessStyle["toolbar-wrapper"]}>
                <LeftOutlined onClick={() => onActive?.(-1)} />
                <RightOutlined onClick={() => onActive?.(1)} />
                <DownloadOutlined onClick={handleDownload} />
                <ZoomOutOutlined disabled={scale === 1 || isOriginalLoading} onClick={onZoomOut} />
                <ZoomInOutlined disabled={scale === 50 || isOriginalLoading} onClick={onZoomIn} />
                <UndoOutlined disabled={isOriginalLoading} onClick={onReset} />
              </Space>
            )
          }}>
          {displayedImages.map((image, index) => {
            const isSelected = image.id === backgroundImageId;
            return (
              <Image
                key={image.id}
                src={image.thumbnailUrl} // 网格中始终显示缩略图
                width={100}
                height={100}
                style={{
                  objectFit: "cover",
                  border: isSelected ? "2px solid #1890ff" : "2px solid transparent", // 高亮选中项
                  padding: "2px" // 为边框留出空间，避免内容跳动
                }}
                preview={{
                  // 单个图片的预览被禁用，由 PreviewGroup 控制
                  visible: false,
                  mask: (
                    <Space
                      direction="vertical"
                      size={8}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        height: "100%",
                        backgroundColor: "rgba(0, 0, 0, 0.6)", // 加深一点背景以便看清白色图标
                        userSelect: "none"
                      }}
                      onClick={(e) => {
                        // 点击遮罩背景区域时，阻止事件冒泡
                        e.stopPropagation();
                      }}>
                      <Space direction="horizontal" size={16}>
                        <DownloadOutlined
                          title="下载"
                          style={{ color: "white", fontSize: "18px", cursor: "pointer" }}
                          onClick={() => {
                            handleDownloadSpecificImage(image.id);
                          }}
                        />
                        <EyeOutlined
                          title="预览"
                          style={{ color: "white", fontSize: "18px", cursor: "pointer" }}
                          onClick={() => {
                            setActivePreviewIndex(index);
                            setPreviewVisible(true);
                          }}
                        />
                      </Space>
                      <Space direction="horizontal" size={16} style={{ marginTop: "8px" }}>
                        <DeleteOutlined
                          title="删除"
                          style={{ color: "white", fontSize: "18px", cursor: "pointer" }}
                          onClick={() => {
                            handleDeleteSpecificImage(image.id);
                          }}
                        />
                        {isSelected ? (
                          <CloseCircleOutlined
                            title="取消设为背景"
                            style={{ color: "white", fontSize: "18px", cursor: "pointer" }}
                            onClick={async () => {
                              setBGIId(null);
                            }}
                          />
                        ) : (
                          <CheckCircleOutlined
                            title="设为背景"
                            style={{ color: "white", fontSize: "18px", cursor: "pointer" }}
                            onClick={async () => {
                              setBGIId(image.id);
                            }}
                          />
                        )}
                      </Space>
                    </Space>
                  )
                }}
              />
            );
          })}
        </Image.PreviewGroup>
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
