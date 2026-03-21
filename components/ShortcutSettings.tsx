import { move } from "@dnd-kit/helpers";
import { createPortal } from "react-dom";
import { DragDropProvider } from "@dnd-kit/react";
import { useStorage } from "@plasmohq/storage/hook";
import { directionBiased } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { createShortcutId, getNoticeTextClass, normalizeUrl } from "~utils/shortcut";
import { getBIS, local, shortcutsLinksKey, shortcutsSwitchKey } from "~storage/local";
import type { DragDropEventHandlers } from "@dnd-kit/react";
import type { ShortcutLink } from "~storage/local";

const MODAL_TRANSITION_MS = 200;

interface Notice {
  type: "error" | "warning" | "info";
  text: string;
}

export function ShortcutSettings() {
  const [shortcutsSwitch, setShortcutsSwitch] = useStorage({ instance: local, key: shortcutsSwitchKey }, false);
  const [shortcutLinks, setShortcutLinks] = useStorage<ShortcutLink[]>({ instance: local, key: shortcutsLinksKey }, []);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");
  const [editingUrl, setEditingUrl] = useState("");
  const [sortModalMounted, setSortModalMounted] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [sortPreviewBgUrl, setSortPreviewBgUrl] = useState<string>();
  const [sortPreviewBgLoading, setSortPreviewBgLoading] = useState(false);
  const [sortDrawerHost, setSortDrawerHost] = useState<HTMLElement | null>(null);
  const [notice, setNotice] = useState<Notice>();
  const sortPreviewBgObjectUrlRef = useRef<string>();
  const sortModalTimerRef = useRef<number>();

  const canSubmit = useMemo(() => title.trim().length > 0 && url.trim().length > 0, [title, url]);

  const setNoticeText = (type: Notice["type"], text: string) => {
    setNotice({ type, text });
  };

  const onAdd = () => {
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

    const nextItem: ShortcutLink = {
      id: createShortcutId(),
      title: nextTitle,
      url: nextUrl
    };
    setShortcutLinks([...(shortcutLinks ?? []), nextItem]);
    setTitle("");
    setUrl("");
    setNotice(undefined);
  };

  const onStartEdit = (item: ShortcutLink) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingUrl(item.url);
  };

  const onCancelEdit = () => {
    setEditingId(undefined);
    setEditingTitle("");
    setEditingUrl("");
  };

  const onSaveEdit = () => {
    if (!editingId) {
      return;
    }
    const nextTitle = editingTitle.trim();
    const nextUrl = normalizeUrl(editingUrl);
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

    setShortcutLinks(
      (shortcutLinks ?? []).map((item) =>
        item.id === editingId
          ? {
              ...item,
              title: nextTitle,
              url: nextUrl
            }
          : item
      )
    );
    setNotice(undefined);
    onCancelEdit();
  };

  const onDelete = (id: string) => {
    if (editingId === id) {
      onCancelEdit();
    }
    setShortcutLinks((shortcutLinks ?? []).filter((item) => item.id !== id));
  };

  const onSortEnd: NonNullable<DragDropEventHandlers["onDragEnd"]> = (event) => {
    setShortcutLinks((items) => move(items ?? [], event));
  };

  useEffect(() => {
    if (!sortModalMounted) {
      setSortDrawerHost(null);
      return;
    }
    setSortDrawerHost(document.body);
  }, [sortModalMounted]);

  useEffect(() => {
    const clearPreviewBackground = () => {
      if (sortPreviewBgObjectUrlRef.current) {
        URL.revokeObjectURL(sortPreviewBgObjectUrlRef.current);
        sortPreviewBgObjectUrlRef.current = undefined;
      }
      setSortPreviewBgUrl(undefined);
    };

    if (!sortModalMounted) {
      clearPreviewBackground();
      return;
    }

    let cancelled = false;
    const loadPreviewBackground = async () => {
      setSortPreviewBgLoading(true);
      try {
        const biSwitch = await getBIS();
        if (!biSwitch) {
          if (!cancelled) {
            clearPreviewBackground();
          }
          return;
        }
        const imageRecord = await imageDb.images.orderBy("id").first();
        if (!imageRecord?.file) {
          if (!cancelled) {
            clearPreviewBackground();
          }
          return;
        }
        const imageUrl = URL.createObjectURL(imageRecord.file);
        if (cancelled) {
          URL.revokeObjectURL(imageUrl);
          return;
        }
        if (sortPreviewBgObjectUrlRef.current) {
          URL.revokeObjectURL(sortPreviewBgObjectUrlRef.current);
        }
        sortPreviewBgObjectUrlRef.current = imageUrl;
        setSortPreviewBgUrl(imageUrl);
      } finally {
        if (!cancelled) {
          setSortPreviewBgLoading(false);
        }
      }
    };

    void loadPreviewBackground();
    return () => {
      cancelled = true;
    };
  }, [sortModalMounted]);

  const openSortModal = () => {
    if (sortModalTimerRef.current) {
      window.clearTimeout(sortModalTimerRef.current);
      sortModalTimerRef.current = undefined;
    }
    setSortModalMounted(true);
    window.requestAnimationFrame(() => {
      setSortModalOpen(true);
    });
  };

  const closeSortModal = () => {
    setSortModalOpen(false);
    if (sortModalTimerRef.current) {
      window.clearTimeout(sortModalTimerRef.current);
    }
    sortModalTimerRef.current = window.setTimeout(() => {
      setSortModalMounted(false);
      sortModalTimerRef.current = undefined;
    }, MODAL_TRANSITION_MS);
  };

  useEffect(
    () => () => {
      if (sortModalTimerRef.current) {
        window.clearTimeout(sortModalTimerRef.current);
      }
    },
    []
  );

  return (
    <div className="relative flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2 pb-1">
        <strong className="text-sm font-bold text-slate-900">快捷访问</strong>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <input type="checkbox" checked={shortcutsSwitch} onChange={(event) => setShortcutsSwitch(event.target.checked)} />
          <span>{shortcutsSwitch ? "已开启" : "已关闭"}</span>
        </label>
      </div>
      {notice ? <div className={`text-xs ${getNoticeTextClass(notice.type)}`}>{notice.text}</div> : null}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <input className="ui-input min-w-[180px] flex-1" value={title} placeholder="名称，如：GitHub" onChange={(event) => setTitle(event.target.value)} />
          <input className="ui-input min-w-[220px] flex-[2]" value={url} placeholder="链接，如：github.com" onChange={(event) => setUrl(event.target.value)} />
          <button type="button" className="ui-button" disabled={!canSubmit} onClick={onAdd}>
            添加
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="flex items-center justify-between gap-2 pb-2">
            <span className="text-xs text-slate-500">已添加 {(shortcutLinks ?? []).length} 项</span>
            <button type="button" className="ui-link-button" disabled={(shortcutLinks ?? []).length < 2} onClick={openSortModal}>
              排序
            </button>
          </div>
          {(shortcutLinks ?? []).length > 0 ? (
            <div className="flex flex-col">
              {(shortcutLinks ?? []).map((item) => (
                <LinkItem
                  key={item.id}
                  item={item}
                  editingId={editingId}
                  editingTitle={editingTitle}
                  editingUrl={editingUrl}
                  onStartEdit={onStartEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  onDelete={onDelete}
                  onChangeEditingTitle={setEditingTitle}
                  onChangeEditingUrl={setEditingUrl}
                />
              ))}
            </div>
          ) : (
            <div className="py-3 text-xs text-slate-500">暂无快捷访问，请先添加链接</div>
          )}
        </div>
      </div>
      {sortModalMounted && sortDrawerHost
        ? createPortal(
            // 全页排序层，层级高于抽屉，低于图片预览。
            <div
              className={`fixed inset-0 z-50 overflow-hidden bg-cover bg-center bg-no-repeat transition-all duration-200 ease-out before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-b before:from-slate-900/20 before:to-slate-900/30 ${
                sortModalOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={sortPreviewBgUrl ? { backgroundImage: `url(${sortPreviewBgUrl})` } : undefined}
            >
              {!sortPreviewBgUrl ? (
                <div className={`absolute inset-0 bg-gradient-to-b from-slate-900/55 to-slate-900/75 transition-opacity duration-200 ease-out ${sortModalOpen ? "opacity-100" : "opacity-0"}`} />
              ) : null}
              <div
                className={`absolute left-0 right-0 top-3.5 z-20 flex justify-center px-4 transition-all duration-200 ease-out md:px-0 ${
                  sortModalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
                }`}
              >
                <button
                  type="button"
                  className="min-h-10 rounded-full border-0 bg-slate-900/70 px-4 text-sm text-slate-50 shadow-[0_12px_28px_rgba(15,23,42,0.25)]"
                  onClick={() => {
                    closeSortModal();
                  }}
                >
                  退出排序
                </button>
              </div>
              {/* 排序主体内容需要压在背景遮罩之上。 */}
              <div
                className={`relative z-10 flex h-full w-full items-center justify-center p-6 pt-[72px] transition-all duration-200 ease-out max-md:min-h-[calc(100vh-56px)] max-md:items-start max-md:p-4 ${
                  sortModalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.97] opacity-0"
                }`}
              >
                {(shortcutLinks ?? []).length > 0 ? (
                  <DragDropProvider onDragEnd={onSortEnd}>
                    <div className="grid w-full max-w-[1200px] grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3.5 max-md:max-w-full">
                      {(shortcutLinks ?? []).map((item, index) => (
                        <SortablePreviewCard key={item.id} item={item} index={index} />
                      ))}
                    </div>
                  </DragDropProvider>
                ) : (
                  <div className="py-3 text-xs text-slate-200">暂无快捷访问，请先添加链接</div>
                )}
              </div>
              {sortPreviewBgLoading ? <div className="absolute bottom-2.5 right-2.5 z-20 rounded-full bg-slate-900/55 px-2 py-1 text-xs text-slate-50">背景图加载中...</div> : null}
            </div>,
            sortDrawerHost
          )
        : null}
    </div>
  );
}

interface LinkItemProps {
  item: ShortcutLink;
  editingId?: string;
  editingTitle: string;
  editingUrl: string;
  onStartEdit: (item: ShortcutLink) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: (id: string) => void;
  onChangeEditingTitle: (value: string) => void;
  onChangeEditingUrl: (value: string) => void;
}

function LinkItem(props: LinkItemProps) {
  const { item, editingId, editingTitle, editingUrl, onStartEdit, onCancelEdit, onSaveEdit, onDelete, onChangeEditingTitle, onChangeEditingUrl } = props;

  return (
    <div className="flex cursor-default justify-between gap-3 border-t border-slate-100 py-2.5">
      <div className="w-full min-w-0">
        {editingId === item.id ? (
          <div className="flex w-full flex-col gap-2">
            <input className="ui-input" value={editingTitle} placeholder="名称，如：GitHub" onChange={(event) => onChangeEditingTitle(event.target.value)} />
            <input className="ui-input" value={editingUrl} placeholder="链接，如：github.com" onChange={(event) => onChangeEditingUrl(event.target.value)} />
          </div>
        ) : (
          <>
            <div className="block truncate text-sm text-slate-900" title={item.title}>
              {item.title}
            </div>
            <div className="block truncate text-xs text-slate-500" title={item.url}>
              {item.url}
            </div>
          </>
        )}
      </div>
      <div className="inline-flex items-center gap-2.5 whitespace-nowrap">
        {editingId === item.id ? (
          <>
            <button type="button" className="ui-link-button" onClick={onCancelEdit}>
              取消
            </button>
            <button type="button" className="ui-link-button" onClick={onSaveEdit}>
              保存
            </button>
          </>
        ) : (
          <button type="button" className="ui-link-button" onClick={() => onStartEdit(item)}>
            编辑
          </button>
        )}
        <button type="button" className="ui-link-button ui-link-danger" onClick={() => onDelete(item.id)}>
          删除
        </button>
      </div>
    </div>
  );
}

interface SortablePreviewCardProps {
  item: ShortcutLink;
  index: number;
}

function SortablePreviewCard(props: SortablePreviewCardProps) {
  const { item, index } = props;
  const [element, setElement] = useState<Element | null>(null);
  const { isDragging, isDragSource, isDropping } = useSortable({
    id: item.id,
    index,
    element,
    collisionDetector: directionBiased,
    transition: {
      duration: 300,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)"
    }
  });

  return (
    <div
      ref={setElement}
      className={`ui-shortcut-card cursor-grab select-none justify-center active:cursor-grabbing ${isDragSource || isDragging ? "scale-[1.02]" : ""} ${isDropping ? "scale-[0.99]" : ""}`}
      data-shadow={isDragging || isDragSource || undefined}
      style={{ height: "100%" }}
    >
      <span className="ui-shortcut-title">{item.title}</span>
      <span className="ui-shortcut-url">{item.url}</span>
    </div>
  );
}
