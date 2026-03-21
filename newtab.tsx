import { useRequest } from "ahooks";
import { useStorage } from "@plasmohq/storage/hook";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { getBIS, local, shortcutsLinksKey, shortcutsSwitchKey } from "~storage/local";
import type { ShortcutLink } from "~storage/local";
import "./styles/main.css";

const Background = lazy(() => import("~components/Background").then((module) => ({ default: module.Background })));
const ShortcutSettings = lazy(() => import("~components/ShortcutSettings").then((module) => ({ default: module.ShortcutSettings })));
const SETTING_DRAWER_TRANSITION_MS = 300;

function IndexNewtab() {
  const [settingDrawerMounted, setSettingDrawerMounted] = useState(false);
  const [settingDrawerOpen, setSettingDrawerOpen] = useState(false);
  const [shortcutsSwitch] = useStorage({ instance: local, key: shortcutsSwitchKey }, false);
  const [shortcutLinks] = useStorage<ShortcutLink[]>({ instance: local, key: shortcutsLinksKey }, []);
  const currentImageObjectUrlRef = useRef<string>();
  const settingDrawerTimerRef = useRef<number>();
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

  useEffect(
    () => () => {
      if (settingDrawerTimerRef.current) {
        window.clearTimeout(settingDrawerTimerRef.current);
      }
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    },
    []
  );

  const openSettingDrawer = () => {
    if (settingDrawerTimerRef.current) {
      window.clearTimeout(settingDrawerTimerRef.current);
    }
    setSettingDrawerMounted(true);
    window.requestAnimationFrame(() => {
      setSettingDrawerOpen(true);
    });
  };

  const closeSettingDrawer = () => {
    setSettingDrawerOpen(false);
    if (settingDrawerTimerRef.current) {
      window.clearTimeout(settingDrawerTimerRef.current);
    }
    settingDrawerTimerRef.current = window.setTimeout(() => {
      setSettingDrawerMounted(false);
      settingDrawerTimerRef.current = undefined;
    }, SETTING_DRAWER_TRANSITION_MS);
  };

  return (
    <>
      <div
        className="flex min-h-screen w-full items-center justify-center p-6"
        onContextMenu={(event) => {
          event.preventDefault();
          openSettingDrawer();
        }}
      >
        {shortcutsSwitch ? (
          <div className="grid w-full max-w-[960px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5">
            {(shortcutLinks ?? []).map((item) => (
              <a key={item.id} href={item.url} className="ui-shortcut-card ui-shortcut-card-interactive" title={item.url}>
                <span className="ui-shortcut-title">{item.title}</span>
                <span className="ui-shortcut-url">{item.url}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {settingDrawerMounted ? (
        // 新标签页设置抽屉的基础层。
        <div className={`fixed inset-0 z-40 ${settingDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`} role="presentation">
          <div
            className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-300 ease-out ${settingDrawerOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => {
              closeSettingDrawer();
            }}
          />
          <aside
            data-setting-drawer="panel"
            className={`absolute right-0 top-0 h-screen w-[min(980px,88vw)] overflow-auto bg-white p-4 shadow-[-8px_0_24px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-[cubic-bezier(0,0,0.2,1)] will-change-transform max-md:w-screen ${
              settingDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Suspense fallback={<div className="text-sm text-slate-500">加载中...</div>}>
              <div className="flex flex-col gap-4">
                <section className="ui-panel">
                  <Background reloadBackground={refresh} />
                </section>
                <section className="ui-panel">
                  <ShortcutSettings />
                </section>
              </div>
            </Suspense>
          </aside>
        </div>
      ) : null}
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
