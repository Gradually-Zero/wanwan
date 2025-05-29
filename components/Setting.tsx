import { useState } from "react";
import { Button, Image, Upload } from "antd";
import { imageDb } from "~indexedDB/ImageDB";
import { newtabBackgroundImageId } from "~storage/wxt";

interface SettingProps {
  backgroundImageId?: number;
}

export function Setting(props: SettingProps) {
  const { backgroundImageId } = props;
  const [imageUrl, setImageUrl] = useState<string>();

  return (
    <>
      <Upload
        accept="image/*,"
        beforeUpload={async (file) => {
          const id = await imageDb.images.add({
            file
          });
          await newtabBackgroundImageId.setValue(id);
          return false;
        }}>
        <Button>选择本地壁纸</Button>
      </Upload>
    </>
  );
}
