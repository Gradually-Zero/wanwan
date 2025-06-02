import type { FileType } from "~interface";

export interface ThumbnailResponseData {
  id: number;
}

export interface ThumbnailAcceptData {
  file: FileType;
  targetWidth?: number;
  targetHeight?: number;
}
