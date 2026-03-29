import { Bookmark } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createCommonId, normalizeUrl } from "~utils/link";
import { bookmarksLinksKey, commonLinksKey, commonSwitchKey, local } from "~storage/local";
import type { BookmarkLink, CommonLink } from "~storage/local";
import "./styles/main.css";

type NoticeType = "success" | "error" | "warning" | "info";

interface Notice {
  type: NoticeType;
  text: string;
}

const noticeClassNameMap: Record<NoticeType, string> = {
  success: "alert-success",
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info"
};

function getNormalizedTitle(title: string | undefined, url: string) {
  const nextTitle = title?.trim();
  if (nextTitle) {
    return nextTitle;
  }
  return url;
}

export default function Popup() {
  const [loadingTab, setLoadingTab] = useState(false);
  const [commonSaving, setCommonSaving] = useState(false);
  const [commonDeleting, setCommonDeleting] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const [bookmarkDeleting, setBookmarkDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [commonLinks, setCommonLinks] = useState<CommonLink[]>([]);
  const [bookmarkLinks, setBookmarkLinks] = useState<BookmarkLink[]>([]);
  const [notice, setNotice] = useState<Notice>();
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url]);
  const existingCommon = useMemo(() => commonLinks.find((item) => item.url === normalizedUrl), [commonLinks, normalizedUrl]);
  const existingBookmark = useMemo(() => bookmarkLinks.find((item) => item.url === normalizedUrl), [bookmarkLinks, normalizedUrl]);
  const canSubmitCommon = useMemo(() => title.trim().length > 0 && url.trim().length > 0, [title, url]);
  const canSubmitBookmark = useMemo(() => title.trim().length > 0 && url.trim().length > 0, [title, url]);
  const inputsDisabled = loadingTab || commonSaving || commonDeleting || bookmarkSaving || bookmarkDeleting;

  const setNoticeText = (type: NoticeType, text: string) => {
    setNotice({ type, text });
  };

  const loadCommonLinks = async () => {
    const list = (await local.get<CommonLink[]>(commonLinksKey)) ?? [];
    setCommonLinks(list);
    return list;
  };

  const loadBookmarkLinks = async () => {
    const list = (await local.get<BookmarkLink[]>(bookmarksLinksKey)) ?? [];
    setBookmarkLinks(list);
    return list;
  };

  const hydrateCurrentTab = async () => {
    setLoadingTab(true);
    try {
      await Promise.all([loadCommonLinks(), loadBookmarkLinks()]);
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tabUrl = tab?.url?.trim();
      if (!tabUrl) {
        setNoticeText("warning", "未获取到当前页面链接");
        return;
      }
      const nextTitle = getNormalizedTitle(tab?.title, tabUrl);
      setTitle(nextTitle);
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

  const onSaveCommon = async () => {
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

    setCommonSaving(true);
    try {
      const list = await loadCommonLinks();
      const existingIndex = list.findIndex((item) => item.url === nextUrl);

      if (existingIndex >= 0) {
        return;
      }

      const nextList: CommonLink[] = [
        ...list,
        {
          id: createCommonId(),
          title: nextTitle,
          url: nextUrl
        }
      ];

      await local.set(commonLinksKey, nextList);
      await local.set(commonSwitchKey, true);
      setCommonLinks(nextList);
      setNoticeText("success", "已添加到常用");
    } catch {
      setNoticeText("error", "保存失败，请稍后重试");
    } finally {
      setCommonSaving(false);
    }
  };

  const onDeleteCommon = async () => {
    if (!existingCommon) {
      return;
    }

    setCommonDeleting(true);
    try {
      const nextList = commonLinks.filter((item) => item.id !== existingCommon.id);
      await local.set(commonLinksKey, nextList);
      setCommonLinks(nextList);
      setNoticeText("success", "已从常用中删除");
    } catch {
      setNoticeText("error", "删除失败，请稍后重试");
    } finally {
      setCommonDeleting(false);
    }
  };

  const onSaveBookmark = async () => {
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

    setBookmarkSaving(true);
    try {
      const list = await loadBookmarkLinks();
      const existingIndex = list.findIndex((item) => item.url === nextUrl);

      if (existingIndex >= 0) {
        return;
      }

      const nextList: BookmarkLink[] = [
        ...list,
        {
          id: createCommonId(),
          title: nextTitle,
          url: nextUrl
        }
      ];

      await local.set(bookmarksLinksKey, nextList);
      setBookmarkLinks(nextList);
      setNoticeText("success", "已添加到书签");
    } catch {
      setNoticeText("error", "保存失败，请稍后重试");
    } finally {
      setBookmarkSaving(false);
    }
  };

  const onDeleteBookmark = async () => {
    if (!existingBookmark) {
      return;
    }

    setBookmarkDeleting(true);
    try {
      const nextList = bookmarkLinks.filter((item) => item.id !== existingBookmark.id);
      await local.set(bookmarksLinksKey, nextList);
      setBookmarkLinks(nextList);
      setNoticeText("success", "已从书签中删除");
    } catch {
      setNoticeText("error", "删除失败，请稍后重试");
    } finally {
      setBookmarkDeleting(false);
    }
  };

  const openBookmarksPage = async () => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/bookmarks.html")
    });
  };

  return (
    <div className="flex w-90 flex-col gap-4 bg-base-200 p-4 text-base-content">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-4">
          <input
            value={title}
            placeholder={loadingTab ? "正在读取当前页面名称..." : "名称"}
            disabled={inputsDisabled}
            onChange={(event) => setTitle(event.target.value)}
            className="input h-10 w-full text-sm"
          />
          <input
            value={url}
            placeholder={loadingTab ? "正在读取当前页面链接..." : "链接"}
            disabled={inputsDisabled}
            onChange={(event) => setUrl(event.target.value)}
            className="input h-10 w-full text-sm"
          />
        </div>
      </section>
      {notice ? (
        <div role="alert" className={`alert alert-soft py-2 text-sm ${noticeClassNameMap[notice.type]}`}>
          <span>{notice.text}</span>
        </div>
      ) : null}
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <button
              type="button"
              disabled={!canSubmitCommon || loadingTab || commonSaving || commonDeleting}
              onClick={existingCommon ? onDeleteCommon : onSaveCommon}
              className={`btn btn-soft h-10 min-h-10 px-3 text-sm font-semibold ${existingCommon ? "btn-error" : "btn-primary"}`}
            >
              {existingCommon ? (commonDeleting ? "删除中..." : "从常用中删除") : commonSaving ? "添加中..." : "添加到常用"}
            </button>
            <button
              type="button"
              disabled={!canSubmitBookmark || loadingTab || bookmarkSaving || bookmarkDeleting}
              onClick={existingBookmark ? onDeleteBookmark : onSaveBookmark}
              className={`btn btn-soft h-10 min-h-10 px-3 text-sm font-semibold ${existingBookmark ? "btn-error" : "btn-primary"}`}
            >
              {existingBookmark ? (bookmarkDeleting ? "删除中..." : "从书签中删除") : bookmarkSaving ? "添加中..." : "添加到书签"}
            </button>
            <button
              type="button"
              className="btn btn-soft btn-primary btn-square h-10 min-h-10 w-10"
              onClick={() => {
                void openBookmarksPage();
              }}
              title="打开书签页面"
              aria-label="打开书签页面"
            >
              <Bookmark className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
