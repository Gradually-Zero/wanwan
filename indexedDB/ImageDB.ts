import Dexie from "dexie";
import type { EntityTable } from "dexie";
import type { GetProp, UploadProps } from "antd";

type FileType = Parameters<GetProp<UploadProps, "beforeUpload">>[0];

interface ImageTableItem {
  /** 自增主键 */
  id: number;
  file: FileType;
}

interface ThumbnailTableItem {
  /** 主键，关联到 ImageTable.id */
  id: number;
  thumbnail: Blob;
}

class ImageDB extends Dexie {
  images: EntityTable<ImageTableItem, "id">;
  thumbnails: EntityTable<ThumbnailTableItem, "id">;
  constructor() {
    // 初始化数据库
    super("ImageDB");
    // 定义表结构
    this.version(1).stores({
      images: "++id, file",
      thumbnails: "id, thumbnail"
    });
    // 获取数据库表的引用
    this.images = this.table("images");
    this.thumbnails = this.table("thumbnails");
  }
}

export const imageDb = new ImageDB();
