import { imageDb } from "~indexedDB/ImageDB";
import type { FileType } from "~interface";
import type { ThumbnailAcceptData, ThumbnailResponseData } from "./thumbnailType";

async function createImageThumbnail(file: FileType, targetWidth: number, targetHeight: number, type = "image/jpeg", quality = 0.8): Promise<Blob> {
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
}

self.onmessage = async (event: MessageEvent<ThumbnailAcceptData>) => {
  const { file, targetWidth = 120, targetHeight = 120 } = event.data;
  const thumbnailBlob = await createImageThumbnail(file, targetWidth, targetHeight);
  const id = await setImageAndCleanUp(file);
  await setThumbnailAndCleanUp(id, thumbnailBlob);
  const data: ThumbnailResponseData = { id };
  self.postMessage(data);
};

/**
 * 确保 'images' 表中只存在一个图片记录，并用新文件更新它
 * @param file - 图片文件
 */
async function setImageAndCleanUp(file: FileType) {
  // 'rw' -> read-write transaction on the 'images' table.
  const firstId = await imageDb.transaction("rw", imageDb.images, async () => {
    // 1. 获取所有主键，这非常快，因为它不加载数据。
    const allKeys = await imageDb.images.orderBy("id").keys();
    if (allKeys.length === 0) {
      const newId = await imageDb.images.add({
        file
      });
      return newId;
    }
    const idToKeep = allKeys[0] as number;
    const idsToDelete = allKeys.slice(1) as number[];
    // 更新第一条
    await imageDb.images.update(idToKeep, { file });
    if (idsToDelete.length > 0) {
      await imageDb.images.bulkDelete(idsToDelete);
    }
    return idToKeep;
  });
  // 事务成功后，firstId 变量将获得返回的值
  return firstId;
}

/**
 * 清空 thumbnails 表，并存入一个全新的缩略图。
 * 整个操作是原子的，要么全部成功，要么全部失败。
 * @param id - 新缩略图的已知 ID
 * @param thumbnail - 新缩略图的 Blob 数据
 */
async function setThumbnailAndCleanUp(id: number, thumbnail: Blob) {
  // 使用 'rw' (read-write) 模式开启一个事务，并锁定 'thumbnails' 表
  await imageDb.transaction("rw", imageDb.thumbnails, async () => {
    // 步骤 1: 清空整个表。这是最高效的删除所有内容的方式。
    await imageDb.thumbnails.clear();
    // 将缩略图存入 thumbnails 表，关联 images.id
    // .put 因为 id 是已知的，如果用 .add 会认为 id 是自增的（除非表结构定义了 id 不是自增）
    await imageDb.thumbnails.put({ id, thumbnail });
  });
}
