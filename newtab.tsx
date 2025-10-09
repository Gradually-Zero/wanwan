import { useRequest } from "ahooks";
import { Drawer, Dropdown } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppstoreOutlined, SettingOutlined } from "@ant-design/icons";
import { getBIS } from "~storage/local";
import { imageDb } from "~indexedDB/ImageDB";
import { Background } from "~components/Background";
import { ViewSetting } from "~components/ViewSetting";
import type { MenuProps } from "antd";
import "./styles/main.css";

const items: MenuProps["items"] = [
  {
    key: "background",
    label: "背景设置",
    icon: <SettingOutlined />
  },
  {
    key: "view",
    label: "界面设置",
    icon: <AppstoreOutlined />
  }
];

function IndexNewtab() {
  const [openSetting, setOpenSetting] = useState(false);
  const [viewSetting, setViewSetting] = useState(false);
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
    if (info?.key === "background") {
      setOpenSetting(true);
    }
    if (info?.key === "view") {
      setViewSetting(true);
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
        <Background reloadBackground={refresh} />
      </Drawer>
      <Drawer
        open={viewSetting}
        size="large"
        title={null}
        closable={false}
        destroyOnHidden
        onClose={() => {
          setViewSetting(false);
        }}>
        <ViewSetting />
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
