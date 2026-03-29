import { useRequest } from "ahooks";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { commonSwitchKey, getBIS, local, setBIS } from "~storage/local";
import type { ThumbnailAcceptData, ThumbnailResponseData } from "~workers/thumbnailType";

const MODAL_TRANSITION_MS = 200;

interface DisplayedImage {
  id: number;
  thumbnailUrl?: string;
}

interface BackgroundProps {
  reloadBackground?: () => void;
}

export function Background(props: BackgroundProps) {
  const { reloadBackground } = props;
  const [thumbnail, setThumbnail] = useState<DisplayedImage>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const [previewMounted, setPreviewMounted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [regeneratingThumbnail, setRegeneratingThumbnail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const currentImageObjectUrlRef = useRef<string | undefined>(undefined);
  const currentThumbnailObjectUrlRef = useRef<string | undefined>(undefined);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: bis, loading: bisLoading, refresh: reloadBIS } = useRequest(getBIS);

  const runThumbnailWorker = useCallback((file: ThumbnailAcceptData["file"]) => {
    return new Promise<number | undefined>((resolve) => {
      const worker = new Worker(new URL("../workers/thumbnail.ts", import.meta.url), { type: "module" });
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          worker.terminate();
          resolve(undefined);
        }
      }, 10000);

      const finish = (id?: number) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeoutId);
        worker.terminate();
        resolve(id);
      };

      worker.onmessage = (e: MessageEvent<ThumbnailResponseData>) => {
        const id = e.data?.id;
        finish(typeof id === "number" ? id : undefined);
      };
      worker.onerror = () => finish(undefined);
      worker.onmessageerror = () => finish(undefined);
      worker.postMessage({ file } satisfies ThumbnailAcceptData);
    });
  }, []);

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
        if (thumbnailResult) {
          const url = URL.createObjectURL(thumbnailResult.thumbnail);
          currentThumbnailObjectUrlRef.current = url;
          setThumbnail({ id: thumbnailResult.id, thumbnailUrl: url });
        } else {
          setThumbnail({ id: imageId });
        }
        return;
      }
      setThumbnail(undefined);
    }
  });

  const clearImagePreviewUrl = () => {
    if (currentImageObjectUrlRef.current) {
      URL.revokeObjectURL(currentImageObjectUrlRef.current);
      currentImageObjectUrlRef.current = undefined;
    }
    setImagePreviewUrl(undefined);
  };

  const setImagePreviewById = async (imageId: number) => {
    const imageRecord = await imageDb.images.get(imageId);
    if (imageRecord?.file) {
      const imageUrl = URL.createObjectURL(imageRecord.file);
      setImagePreviewUrl(imageUrl);
      currentImageObjectUrlRef.current = imageUrl;
      return true;
    }
    return false;
  };

  const openPreview = async () => {
    if (!thumbnail?.id) {
      return;
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    clearImagePreviewUrl();
    const ok = await setImagePreviewById(thumbnail.id);
    if (ok) {
      setPreviewMounted(true);
      window.requestAnimationFrame(() => {
        setPreviewOpen(true);
      });
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewMounted(false);
      previewTimerRef.current = null;
      clearImagePreviewUrl();
    }, MODAL_TRANSITION_MS);
  };

  const handleUploadFile = async (file?: File) => {
    if (!file) {
      return;
    }
    setUploading(true);
    const id = await runThumbnailWorker(file);
    await refresh();
    if (typeof id === "number") {
      await setBIS(true);
      reloadBackground?.();
      reloadBIS();
    }
    setUploading(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!thumbnail?.id) {
      return;
    }
    const confirmed = window.confirm("确认删除这张背景图？");
    if (!confirmed) {
      return;
    }
    const imageId = thumbnail.id;
    await imageDb.images.delete(imageId);
    await imageDb.thumbnails.delete(imageId);
    await refresh();
    const biSwitch = await getBIS();
    if (biSwitch) {
      await setBIS(false);
      reloadBackground?.();
      reloadBIS();
    }
  };

  const handleDownload = async () => {
    if (!thumbnail?.id) {
      return;
    }
    const imageRecord = await imageDb.images.get(thumbnail.id);
    if (!imageRecord?.file) {
      return;
    }
    const downloadUrl = URL.createObjectURL(imageRecord.file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = imageRecord.file.name || `image-${imageRecord.id}`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleRegenerateThumbnail = async () => {
    if (!thumbnail?.id) {
      return;
    }
    const imageRecord = await imageDb.images.get(thumbnail.id);
    if (!imageRecord?.file) {
      return;
    }
    setRegeneratingThumbnail(true);
    await runThumbnailWorker(imageRecord.file);
    await refresh();
    setRegeneratingThumbnail(false);
  };

  const handleSwitchChange = useCallback(
    async (checked: boolean) => {
      if (!thumbnail?.id) {
        return;
      }
      await setBIS(checked);
      if (!checked) {
        await local.set(commonSwitchKey, false);
      }
      reloadBackground?.();
      reloadBIS();
    },
    [thumbnail, reloadBackground, reloadBIS]
  );

  useEffect(
    () => () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-base-content">启用背景图</span>
        <label className="inline-flex items-center gap-2 text-xs text-base-content/70">
          <input className="toggle toggle-sm" type="checkbox" checked={Boolean(bis)} disabled={!thumbnail || bisLoading} onChange={(event) => void handleSwitchChange(event.target.checked)} />
        </label>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          void handleUploadFile(file);
        }}
      />
      {thumbnail ? (
        <div className="flex flex-wrap items-start gap-4">
          {thumbnail.thumbnailUrl ? (
            <button type="button" className="cursor-pointer border-0 bg-transparent p-0" onClick={() => void openPreview()}>
              <img src={thumbnail.thumbnailUrl} width={102} height={102} alt="背景图缩略图" className="size-26 rounded-sm border border-base-300 object-cover shadow-sm" />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex size-26 cursor-pointer items-center justify-center rounded-sm border border-dashed border-base-300 bg-base-200 p-2 text-center text-xs leading-5 text-base-content/70"
              onClick={() => void openPreview()}
            >
              缩略图缺失，点击预览原图
            </button>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center">
              <span className="text-xs text-base-content/60">点击缩略图可预览原图</span>
              <div className="flex items-center gap-1 ml-1">
                <button type="button" className="btn btn-link btn-sm p-0 text-error" onClick={() => void handleDelete()}>
                  删除背景图
                </button>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => void handleDownload()}>
                  下载原图
                </button>
                {!thumbnail.thumbnailUrl ? (
                  <button type="button" className="btn btn-link btn-sm p-0" disabled={regeneratingThumbnail} onClick={() => void handleRegenerateThumbnail()}>
                    {regeneratingThumbnail ? "重新生成中..." : "重新生成缩略图"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={uploading} onClick={() => uploadInputRef.current?.click()}>
                {uploading ? "上传中..." : "替换图片"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-base-content/60">还没有设置背景图</div>
          <button type="button" className="btn btn-primary btn-sm" disabled={uploading} onClick={() => uploadInputRef.current?.click()}>
            {uploading ? "上传中..." : "上传图片"}
          </button>
        </div>
      )}
      {previewMounted && imagePreviewUrl
        ? createPortal(
            // 图片预览层级最高，需要脱离抽屉容器，避免被滚动和裁剪影响。
            <div
              className={`fixed inset-0 z-60 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
                previewOpen ? "pointer-events-auto bg-black/45 opacity-100" : "pointer-events-none bg-black/0 opacity-0"
              }`}
              role="presentation"
              onClick={closePreview}
            >
              <img
                src={imagePreviewUrl}
                alt="背景图预览"
                className={`max-h-[90vh] max-w-[min(1200px,92vw)] rounded-sm transition-all duration-200 ease-out ${
                  previewOpen ? "scale-100 translate-y-0 opacity-100" : "scale-95 translate-y-2 opacity-0"
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                }}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
