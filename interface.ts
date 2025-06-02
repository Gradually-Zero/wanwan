import type { GetProp, UploadProps } from "antd";

export type BeforeUpload = GetProp<UploadProps, "beforeUpload">;

export type FileType = Parameters<BeforeUpload>[0];
