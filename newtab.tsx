import { useRequest } from "ahooks";
import { useStorage } from "@plasmohq/storage/hook";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { commonLinksKey, commonSwitchKey, getBIS, local } from "~storage/local";
import type { CommonLink } from "~storage/local";
import "./styles/main.css";

const Background = lazy(() => import("~components/Background").then((module) => ({ default: module.Background })));
const CommonSettings = lazy(() => import("~components/CommonSettings").then((module) => ({ default: module.CommonSettings })));
const SETTING_DRAWER_TRANSITION_MS = 300;

function IndexNewtab() {
  const [settingDrawerMounted, setSettingDrawerMounted] = useState(false);
  const [settingDrawerOpen, setSettingDrawerOpen] = useState(false);
  const [sortModeOpen, setSortModeOpen] = useState(false);
  const [commonSwitch] = useStorage({ instance: local, key: commonSwitchKey }, false);
  const [commonLinks] = useStorage<CommonLink[]>({ instance: local, key: commonLinksKey }, []);
  const currentImageObjectUrlRef = useRef<string | null>(null);
  const settingDrawerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        clearTimeout(settingDrawerTimerRef.current);
      }
      if (currentImageObjectUrlRef.current) {
        URL.revokeObjectURL(currentImageObjectUrlRef.current);
      }
    },
    []
  );

  const openSettingDrawer = () => {
    if (settingDrawerTimerRef.current) {
      clearTimeout(settingDrawerTimerRef.current);
      settingDrawerTimerRef.current = null;
    }
    setSettingDrawerMounted(true);
    window.requestAnimationFrame(() => {
      setSettingDrawerOpen(true);
    });
  };

  const closeSettingDrawer = () => {
    setSettingDrawerOpen(false);
    if (settingDrawerTimerRef.current) {
      clearTimeout(settingDrawerTimerRef.current);
      settingDrawerTimerRef.current = null;
    }
    settingDrawerTimerRef.current = setTimeout(() => {
      if (sortModeOpen) {
        settingDrawerTimerRef.current = null;
        return;
      }
      setSettingDrawerMounted(false);
      settingDrawerTimerRef.current = null;
    }, SETTING_DRAWER_TRANSITION_MS);
  };

  const openSortMode = () => {
    if (settingDrawerTimerRef.current) {
      clearTimeout(settingDrawerTimerRef.current);
      settingDrawerTimerRef.current = null;
    }
    setSettingDrawerOpen(false);
    setSortModeOpen(true);
  };

  const closeSortMode = () => {
    if (settingDrawerTimerRef.current) {
      clearTimeout(settingDrawerTimerRef.current);
      settingDrawerTimerRef.current = null;
    }
    setSortModeOpen(false);
    openSettingDrawer();
  };

  const onSettingDrawerTransitionEnd = () => {
    if (settingDrawerOpen || sortModeOpen) {
      return;
    }
    setSettingDrawerMounted(false);
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
        {commonSwitch ? (
          <div className="common-links-grid">
            {(commonLinks ?? []).map((item) => (
              <a
                key={item.id}
                href={item.url}
                title={item.url}
                className="card rounded-2xl bg-slate-900/45 text-white no-underline shadow-lg shadow-slate-950/15 backdrop-blur-md transition duration-150 hover:-translate-y-0.5 hover:bg-slate-900/60 hover:shadow-xl hover:shadow-slate-950/25"
              >
                <div className="card-body gap-1.5 px-4 py-3.5">
                  <span className="truncate text-[16px] font-bold">{item.title}</span>
                  <span className="truncate text-xs opacity-90">{item.url}</span>
                </div>
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {settingDrawerMounted ? (
        // 新标签页设置抽屉的基础层。
        <div className={`fixed inset-0 z-40 ${settingDrawerOpen ? "pointer-events-auto" : "pointer-events-none"}`} role="presentation">
          <div
            className={`absolute inset-0 bg-neutral/35 backdrop-blur-[1px] transition-opacity duration-200 ease-out ${settingDrawerOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => {
              closeSettingDrawer();
            }}
          />
          <aside
            data-setting-drawer="panel"
            className={`absolute right-0 top-0 h-screen w-[min(980px,88vw)] overflow-auto border-l border-base-300 bg-base-200/95 p-4 text-base-content shadow-[-12px_0_32px_rgba(15,23,42,0.18)] backdrop-blur-md transition-transform duration-200 ease-out will-change-transform max-md:w-screen ${
              settingDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            onTransitionEnd={(event) => {
              if (event.target !== event.currentTarget || event.propertyName !== "transform") {
                return;
              }
              onSettingDrawerTransitionEnd();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Suspense fallback={<div className="px-2 py-1 text-sm text-base-content/60">加载中...</div>}>
              <div className="flex flex-col gap-4">
                <section className="card border border-base-300 bg-base-100 shadow-sm">
                  <div className="card-body p-4">
                    <Background reloadBackground={refresh} />
                  </div>
                </section>
                <section className="card border border-base-300 bg-base-100 shadow-sm">
                  <div className="card-body p-4">
                    <CommonSettings sortModalOpen={sortModeOpen} onOpenSortModal={openSortMode} onCloseSortModal={closeSortMode} />
                  </div>
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
