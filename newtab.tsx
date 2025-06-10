import { useAsyncEffect } from "ahooks";
import { Drawer, Dropdown } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { Setting } from "~components/Setting";
import { BGIKey, local } from "~storage/local";
import type { MenuProps } from "antd";
import "./styles/main.css";

const items: MenuProps["items"] = [
  {
    key: "setting",
    label: "设置",
    icon: <SettingOutlined />
  }
];

function IndexNewtab() {
  const [openSetting, setOpenSetting] = useState(false);
  const [backgroundImageId, setBackgroundImageId] = useState<number | null>();
  const currentImageObjectUrlRef = useRef<string>();

  const menuOnClick = useCallback<Required<MenuProps>["onClick"]>((info) => {
    if (info?.key === "setting") {
      setOpenSetting(true);
    }
  }, []);

  useAsyncEffect(async () => {
    const BGIId = await local.get<number>(BGIKey);
    setBackgroundImageId(BGIId);
    setBackground(BGIId, currentImageObjectUrlRef);
    local.watch({
      [BGIKey]: (change) => {
        const newValue = change?.newValue;
        setBackgroundImageId(newValue);
        setBackground(newValue, currentImageObjectUrlRef);
      }
    });
  }, []);

  useEffect(
    () => () => {
      local.unwatchAll();
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    },
    []
  );

  return (
    <>
      <Dropdown trigger={["contextMenu"]} menu={{ items, onClick: menuOnClick }}>
        <div style={{ height: "100vh", width: "100vw" }} />
      </Dropdown>
      <Drawer
        open={openSetting}
        size="large"
        title={null}
        closable={false}
        destroyOnHidden
        onClose={() => {
          setOpenSetting(false);
        }}>
        <Setting backgroundImageId={backgroundImageId} />
      </Drawer>
    </>
  );
}

export default IndexNewtab;

async function setBackground(id?: number | null, currentImageObjectUrlRef?: React.MutableRefObject<string | undefined>) {
  if (typeof id !== "number") {
    document.body.style.backgroundImage = "";
    return;
  }
  const currentImage = await imageDb.images.get(id);
  if (currentImage === undefined) {
    document.body.style.backgroundImage = "";
    return;
  }
  const imageUrl = URL.createObjectURL(currentImage.file);
  if (currentImageObjectUrlRef) {
    currentImageObjectUrlRef.current = imageUrl;
  }
  document.body.style.backgroundImage = `url(${imageUrl})`;
}
