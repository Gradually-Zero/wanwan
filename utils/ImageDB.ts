import Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { GetProp, UploadProps } from 'antd';

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];

interface BackgroundImage {
  id: number;
  file: FileType;
}

class ImageDB extends Dexie {
  images: EntityTable<BackgroundImage, 'id'>;
  constructor() {
    // 初始化数据库
    super('ImageDB');
    // 定义表结构
    this.version(1).stores({
      images: '++id, file',
    });
    // 获取数据库表的引用
    this.images = this.table('images');
  }
}

export const imageDb = new ImageDB();
