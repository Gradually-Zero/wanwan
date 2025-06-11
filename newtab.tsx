import { useRequest } from "ahooks";
import { Drawer, Dropdown } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBIS } from "~storage/local";
import { imageDb } from "~indexedDB/ImageDB";
import { Setting } from "~components/Setting";
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
  const currentImageObjectUrlRef = useRef<string>();
  const { refresh } = useRequest(getImage, {
    onBefore: () => {
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    },
    onSuccess: (data) => {
      const file = data?.file;
      if (file) {
        const imageUrl = URL.createObjectURL(file);
        currentImageObjectUrlRef.current = imageUrl;
        document.body.style.backgroundImage = `url(${imageUrl})`;
        return;
      }
      document.body.style.backgroundImage = "";
    }
  });

  const menuOnClick = useCallback<Required<MenuProps>["onClick"]>((info) => {
    if (info?.key === "setting") {
      setOpenSetting(true);
    }
  }, []);

  useEffect(
    () => () => {
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
        <Setting reloadBackground={refresh} />
      </Drawer>
    </>
  );
}

export default IndexNewtab;

async function getImage() {
  const biSwitch = await getBIS();
  if (biSwitch) {
    return imageDb.images.orderBy("id").first();
  }
  return undefined;
}
