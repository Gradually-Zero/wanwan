import { Drawer, Dropdown } from 'antd';
import { useAsyncEffect } from 'ahooks';
import { useCallback, useState } from 'react';
import { SettingOutlined } from '@ant-design/icons';
import { imageDb } from '@/utils/ImageDB';
import { Setting } from '@/components/Setting';
import { newtabBackgroundImageId } from '@/utils/storage';
import type { MenuProps } from 'antd';

const items: MenuProps['items'] = [
  {
    key: 'setting',
    label: '设置',
    icon: <SettingOutlined />,
  },
];

function App() {
  const [openSetting, setOpenSetting] = useState(false);
  const [backgroundImageId, setBackgroundImageId] = useState<number>();

  const menuOnClick = useCallback<Required<MenuProps>['onClick']>((info) => {
    if (info?.key === 'setting') {
      setOpenSetting(true);
    }
  }, []);

  useAsyncEffect(async () => {
    const value = await newtabBackgroundImageId.getValue();
    setBackgroundImageId(value);
    setBackground(value);
    newtabBackgroundImageId.watch((newValue) => {
      setBackgroundImageId(newValue);
      setBackground(newValue);
    });
  }, []);

  return (
    <>
      <Dropdown trigger={['contextMenu']} menu={{ items, onClick: menuOnClick }}>
        <div style={{ height: '100vh', width: '100vw' }} />
      </Dropdown>
      <Drawer
        open={openSetting}
        size="large"
        title={null}
        closable={false}
        destroyOnHidden
        onClose={() => {
          setOpenSetting(false);
        }}
      >
        <Setting backgroundImageId={backgroundImageId} />
      </Drawer>
    </>
  );
}

export default App;

async function setBackground(id: number) {
  const currentImage = await imageDb.images.get(id);
  if (currentImage?.file) {
    const imageUrl = URL.createObjectURL(currentImage.file);
    document.body.style.backgroundImage = `url(${imageUrl})`;
  }
}
