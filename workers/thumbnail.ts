async function createImageThumbnail(file: File, targetWidth: number, targetHeight: number, type = "image/jpeg", quality = 0.8): Promise<Blob | null> {
  try {
    const imageBitmap = await createImageBitmap(file);

    const originalWidth = imageBitmap.width;
    const originalHeight = imageBitmap.height;

    let drawWidth = targetWidth;
    let drawHeight = targetHeight;
    let offsetX = 0;
    let offsetY = 0;

    // 计算保持宽高比的绘制尺寸和偏移量（可选：裁剪到中心）
    const originalAspectRatio = originalWidth / originalHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    if (originalAspectRatio > targetAspectRatio) {
      // 原图更宽
      drawHeight = targetHeight;
      drawWidth = drawHeight * originalAspectRatio;
      offsetX = (targetWidth - drawWidth) / 2; // 中心裁剪
    } else {
      // 原图更高或比例相同
      drawWidth = targetWidth;
      drawHeight = drawWidth / originalAspectRatio;
      offsetY = (targetHeight - drawHeight) / 2; // 中心裁剪
    }
    // 如果不想裁剪，而是想完整显示并可能留白，则使用 Math.min 策略
    // const scaleFactor = Math.min(targetWidth / originalWidth, targetHeight / originalHeight);
    // drawWidth = originalWidth * scaleFactor;
    // drawHeight = originalHeight * scaleFactor;
    // offsetX = (targetWidth - drawWidth) / 2;
    // offsetY = (targetHeight - drawHeight) / 2; G

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Unable to get OffscreenCanvas context");
    }

    // 可选：填充背景色，如果缩略图可能包含透明区域或留白
    // ctx.fillStyle = 'white';
    // ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.drawImage(imageBitmap, offsetX, offsetY, drawWidth, drawHeight);
    // 或者，如果你想从原图裁剪特定区域并缩放：
    // ctx.drawImage(imageBitmap, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

    const thumbnailBlob = await canvas.convertToBlob({ type, quality });
    imageBitmap.close(); // 释放 ImageBitmap 占用的资源

    return thumbnailBlob;
  } catch (error) {
    console.error("Error creating thumbnail in worker:", error);
    return null; // 保持和 Promise<Blob | null> 类型一致
  }
}

interface WorkerEventData {
  file: File;
  targetWidth?: number;
  targetHeight?: number;
}

self.onmessage = async (event: MessageEvent<WorkerEventData>) => {
  const { file, targetWidth = 120, targetHeight = 120 } = event.data; // 提供默认值

  try {
    const thumbnailBlob = await createImageThumbnail(file, targetWidth, targetHeight);
    if (thumbnailBlob) {
      self.postMessage({ thumbnail: thumbnailBlob, error: null });
    } else {
      self.postMessage({ thumbnail: null, error: "Failed to create thumbnail in worker" });
    }
  } catch (e) {
    const error = e as Error;
    self.postMessage({ thumbnail: null, error: error.message });
  }
};
