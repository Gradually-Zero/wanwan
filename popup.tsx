import { useEffect, useMemo, useState } from "react";
import { local, shortcutsLinksKey, shortcutsSwitchKey } from "~storage/local";
import { createShortcutId, getNoticeTextClass, normalizeUrl } from "~utils/shortcut";
import type { ShortcutLink } from "~storage/local";
import "./styles/main.css";

const CLOSE_DELAY_MS = 3000;

type NoticeType = "success" | "error" | "warning" | "info";

interface Notice {
  type: NoticeType;
  text: string;
}

function getNormalizedTitle(title: string | undefined, url: string) {
  const nextTitle = title?.trim();
  if (nextTitle) {
    return nextTitle;
  }
  return url;
}

export default function Popup() {
  const [loadingTab, setLoadingTab] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const canSubmit = useMemo(() => title.trim().length > 0 && url.trim().length > 0, [title, url]);

  const setNoticeText = (type: NoticeType, text: string) => {
    setNotice({ type, text });
  };

  const hydrateCurrentTab = async () => {
    setLoadingTab(true);
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabUrl = tab?.url?.trim();
      if (!tabUrl) {
        setNoticeText("warning", "未获取到当前页面链接");
        return;
      }
      setTitle(getNormalizedTitle(tab?.title, tabUrl));
      setUrl(tabUrl);
    } catch {
      setNoticeText("error", "读取当前页面失败");
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    void hydrateCurrentTab();
    // 仅在弹窗打开时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    const nextTitle = title.trim();
    const nextUrl = normalizeUrl(url);
    if (!nextTitle || !nextUrl) {
      setNoticeText("warning", "请填写完整名称和链接");
      return;
    }
    try {
      new URL(nextUrl);
    } catch {
      setNoticeText("error", "链接格式不正确");
      return;
    }

    setSaving(true);
    try {
      const list = (await local.get<ShortcutLink[]>(shortcutsLinksKey)) ?? [];
      const existingIndex = list.findIndex((item) => item.url === nextUrl);

      if (existingIndex >= 0) {
        const existing = list[existingIndex];
        if (existing.title !== nextTitle) {
          const nextList = [...list];
          nextList[existingIndex] = {
            ...existing,
            title: nextTitle
          };
          await local.set(shortcutsLinksKey, nextList);
          await local.set(shortcutsSwitchKey, true);
          setNoticeText("info", "已存在该链接，已更新名称");
        } else {
          setNoticeText("warning", "该链接已存在");
        }
        return;
      }

      const nextList: ShortcutLink[] = [
        ...list,
        {
          id: createShortcutId(),
          title: nextTitle,
          url: nextUrl
        }
      ];

      await local.set(shortcutsLinksKey, nextList);
      await local.set(shortcutsSwitchKey, true);
      setNoticeText("success", "已添加到快捷访问，3 秒后自动关闭");
      setTimeout(() => window.close(), CLOSE_DELAY_MS);
    } catch {
      setNoticeText("error", "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-[340px] flex-col bg-slate-50 p-3 text-slate-900">
      <div className="flex flex-col gap-2.5">
        <div className="text-[15px] font-bold">添加快捷访问</div>
        <input
          value={title}
          placeholder={loadingTab ? "正在读取当前页面名称..." : "名称"}
          disabled={saving}
          onChange={(event) => setTitle(event.target.value)}
          className="ui-input rounded-md shadow-sm"
        />
        <input value={url} placeholder={loadingTab ? "正在读取当前页面链接..." : "链接"} disabled={saving} onChange={(event) => setUrl(event.target.value)} className="ui-input rounded-md shadow-sm" />
        <button type="button" disabled={!canSubmit || loadingTab || saving} onClick={onSave} className="ui-button-compact">
          {saving ? "保存中..." : "保存"}
        </button>
        {notice ? <div className={`text-xs ${getNoticeTextClass(notice.type)}`}>{notice.text}</div> : null}
      </div>
    </div>
  );
}
