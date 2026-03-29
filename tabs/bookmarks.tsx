import { useStorage } from "@plasmohq/storage/hook";
import { useEffect, useMemo, useRef, useState } from "react";
import { bookmarksLinksKey, local } from "~storage/local";
import { ConfirmModal, FormModal } from "~components/Modal";
import { createCommonId, getBookmarkExportFileName, normalizeUrl, parseBookmarkLinksJson, regenerateBookmarkIds, serializeBookmarkLinks } from "~utils/link";
import type { BookmarkLink } from "~storage/local";
import "../styles/main.css";

const MODAL_TRANSITION_MS = 200;

interface Notice {
  type: "success" | "error" | "warning" | "info";
  text: string;
}

const noticeClassNameMap: Record<Notice["type"], string> = {
  success: "alert-success",
  error: "alert-error",
  warning: "alert-warning",
  info: "alert-info"
};

type BookmarkFormMode = "add" | "edit";

export default function BookmarksPage() {
  const [bookmarkLinks, setBookmarkLinks] = useStorage<BookmarkLink[]>({ instance: local, key: bookmarksLinksKey }, []);
  const [filterTitle, setFilterTitle] = useState("");
  const [filterUrl, setFilterUrl] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formMode, setFormMode] = useState<BookmarkFormMode>("add");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formModalMounted, setFormModalMounted] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookmarkLink | undefined>(undefined);
  const [confirmModalMounted, setConfirmModalMounted] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bulkConfirmModalMounted, setBulkConfirmModalMounted] = useState(false);
  const [bulkConfirmModalOpen, setBulkConfirmModalOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const formModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulkConfirmModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const canSubmit = useMemo(() => formTitle.trim().length > 0 && formUrl.trim().length > 0, [formTitle, formUrl]);
  const filteredBookmarkLinks = useMemo(() => {
    const normalizedTitle = filterTitle.trim().toLowerCase();
    const normalizedUrl = filterUrl.trim().toLowerCase();

    return (bookmarkLinks ?? []).filter((item) => {
      const matchesTitle = !normalizedTitle || item.title.toLowerCase().includes(normalizedTitle);
      const matchesUrl = !normalizedUrl || item.url.toLowerCase().includes(normalizedUrl);
      return matchesTitle && matchesUrl;
    });
  }, [bookmarkLinks, filterTitle, filterUrl]);
  const filteredBookmarkIds = useMemo(() => filteredBookmarkLinks.map((item) => item.id), [filteredBookmarkLinks]);
  const hasFilteredBookmarkLinks = filteredBookmarkIds.length > 0;
  const allFilteredBookmarkSelected = hasFilteredBookmarkLinks && filteredBookmarkIds.every((id) => selectedIds.has(id));

  const setNoticeText = (type: Notice["type"], text: string) => {
    setNotice({ type, text });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setSelectedIds(new Set());
  };

  const resetFormModalState = () => {
    setFormMode("add");
    setEditingId(undefined);
    setFormTitle("");
    setFormUrl("");
  };

  const openFormModal = (mode: BookmarkFormMode, item?: BookmarkLink) => {
    if (formModalTimerRef.current) {
      clearTimeout(formModalTimerRef.current);
      formModalTimerRef.current = null;
    }
    setFormMode(mode);
    setEditingId(item?.id);
    setFormTitle(item?.title ?? "");
    setFormUrl(item?.url ?? "");
    setFormModalMounted(true);
    window.requestAnimationFrame(() => {
      setFormModalOpen(true);
    });
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    if (formModalTimerRef.current) {
      clearTimeout(formModalTimerRef.current);
    }
    formModalTimerRef.current = setTimeout(() => {
      setFormModalMounted(false);
      formModalTimerRef.current = null;
      resetFormModalState();
    }, MODAL_TRANSITION_MS);
  };

  const openDeleteModal = (item: BookmarkLink) => {
    if (confirmModalTimerRef.current) {
      clearTimeout(confirmModalTimerRef.current);
      confirmModalTimerRef.current = null;
    }
    setDeleteTarget(item);
    setConfirmModalMounted(true);
    window.requestAnimationFrame(() => {
      setConfirmModalOpen(true);
    });
  };

  const closeDeleteModal = () => {
    setConfirmModalOpen(false);
    if (confirmModalTimerRef.current) {
      clearTimeout(confirmModalTimerRef.current);
    }
    confirmModalTimerRef.current = setTimeout(() => {
      setConfirmModalMounted(false);
      confirmModalTimerRef.current = null;
      setDeleteTarget(undefined);
    }, MODAL_TRANSITION_MS);
  };

  const openBulkDeleteModal = () => {
    if (selectedIds.size === 0) {
      return;
    }
    if (bulkConfirmModalTimerRef.current) {
      clearTimeout(bulkConfirmModalTimerRef.current);
      bulkConfirmModalTimerRef.current = null;
    }
    setBulkConfirmModalMounted(true);
    window.requestAnimationFrame(() => {
      setBulkConfirmModalOpen(true);
    });
  };

  const closeBulkDeleteModal = () => {
    setBulkConfirmModalOpen(false);
    if (bulkConfirmModalTimerRef.current) {
      clearTimeout(bulkConfirmModalTimerRef.current);
    }
    bulkConfirmModalTimerRef.current = setTimeout(() => {
      setBulkConfirmModalMounted(false);
      bulkConfirmModalTimerRef.current = null;
    }, MODAL_TRANSITION_MS);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredBookmarkSelected) {
        filteredBookmarkIds.forEach((id) => {
          next.delete(id);
        });
      } else {
        filteredBookmarkIds.forEach((id) => {
          next.add(id);
        });
      }
      return next;
    });
  };

  const onSaveForm = () => {
    const nextTitle = formTitle.trim();
    const nextUrl = normalizeUrl(formUrl);
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

    const exists = (bookmarkLinks ?? []).some((item) => item.id !== editingId && item.url === nextUrl);
    if (exists) {
      setNoticeText("warning", "该书签已存在");
      return;
    }

    if (formMode === "edit" && editingId) {
      setBookmarkLinks(
        (bookmarkLinks ?? []).map((item) =>
          item.id === editingId
            ? {
                ...item,
                title: nextTitle,
                url: nextUrl
              }
            : item
        )
      );
      closeFormModal();
      setNoticeText("success", "已更新书签");
      return;
    }

    const nextItem: BookmarkLink = {
      id: createCommonId(),
      title: nextTitle,
      url: nextUrl
    };
    setBookmarkLinks([...(bookmarkLinks ?? []), nextItem]);
    closeFormModal();
    setNoticeText("success", "已添加到书签");
  };

  const onConfirmDelete = () => {
    if (!deleteTarget) {
      return;
    }
    setBookmarkLinks((bookmarkLinks ?? []).filter((item) => item.id !== deleteTarget.id));
    closeDeleteModal();
    setNoticeText("success", "已从书签中删除");
  };

  const onConfirmBulkDelete = () => {
    if (selectedIds.size === 0) {
      return;
    }
    setBookmarkLinks((bookmarkLinks ?? []).filter((item) => !selectedIds.has(item.id)));
    closeBulkDeleteModal();
    const deletedCount = selectedIds.size;
    exitBulkMode();
    setNoticeText("success", `已删除 ${deletedCount} 项书签`);
  };

  const onExport = () => {
    const payload = serializeBookmarkLinks(bookmarkLinks ?? []);
    const exportBlob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const exportUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = getBookmarkExportFileName();
    link.click();
    URL.revokeObjectURL(exportUrl);
    setNoticeText("success", "已导出书签 JSON");
  };

  const onImport = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const importedLinks = regenerateBookmarkIds(parseBookmarkLinksJson(text));
      if (importedLinks.length === 0) {
        setNoticeText("info", "导入成功，但没有新增书签");
        return;
      }

      setBookmarkLinks([...(bookmarkLinks ?? []), ...importedLinks]);
      setNoticeText("success", `已导入 ${importedLinks.length} 项书签`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败，请检查 JSON 文件";
      setNoticeText("error", message);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  useEffect(
    () => () => {
      if (formModalTimerRef.current) {
        clearTimeout(formModalTimerRef.current);
      }
      if (confirmModalTimerRef.current) {
        clearTimeout(confirmModalTimerRef.current);
      }
      if (bulkConfirmModalTimerRef.current) {
        clearTimeout(bulkConfirmModalTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const validIds = new Set((bookmarkLinks ?? []).map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [bookmarkLinks]);

  useEffect(() => {
    document.title = chrome.i18n.getMessage("bookmarksPageTitle");
  }, []);

  return (
    <div className="min-h-screen bg-base-200 p-6 text-base-content">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {notice ? (
          <div role="alert" className={`alert alert-soft text-sm ${noticeClassNameMap[notice.type]}`}>
            <span>{notice.text}</span>
          </div>
        ) : null}
        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-base-content">书签</h1>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(event) => {
                    void onImport(event.target.files?.[0]);
                  }}
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => importInputRef.current?.click()}>
                  导入
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onExport}>
                  导出
                </button>
              </div>
            </div>
          </div>
          <div className="card-body p-5 pt-0">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <span className="text-xs text-base-content/60">{bulkMode ? `已选 ${selectedIds.size} 项` : `显示 ${filteredBookmarkLinks.length} / 共 ${(bookmarkLinks ?? []).length} 项`}</span>
              <div className="flex items-center gap-2">
                {bulkMode ? (
                  <>
                    <button type="button" className="btn btn-link btn-sm px-1" disabled={!hasFilteredBookmarkLinks} onClick={toggleSelectAllFiltered}>
                      {allFilteredBookmarkSelected ? "取消当前所有" : "勾选当前所有"}
                    </button>
                    <button type="button" className="btn btn-link btn-sm px-1" onClick={exitBulkMode}>
                      取消
                    </button>
                    <button type="button" className="btn btn-link btn-sm px-1 text-error" disabled={selectedIds.size === 0} onClick={openBulkDeleteModal}>
                      删除所选
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-link btn-sm px-1" onClick={() => openFormModal("add")}>
                      添加书签
                    </button>
                    <button type="button" className="btn btn-link btn-sm px-1 text-error" disabled={(bookmarkLinks ?? []).length === 0} onClick={() => setBulkMode(true)}>
                      批量删除
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pb-3">
              <input className="input min-w-45 flex-1" value={filterTitle} placeholder="搜索名称" onChange={(event) => setFilterTitle(event.target.value)} />
              <input className="input min-w-55 flex-[1.2]" value={filterUrl} placeholder="搜索链接" onChange={(event) => setFilterUrl(event.target.value)} />
            </div>
            {(bookmarkLinks ?? []).length === 0 ? (
              <div className="py-3 text-xs text-base-content/60">暂无书签，请先添加链接</div>
            ) : filteredBookmarkLinks.length > 0 ? (
              <div className="flex flex-col">
                {filteredBookmarkLinks.map((item, index) => (
                  <div key={item.id} className={`flex cursor-default justify-between gap-3 py-2.5 ${index > 0 ? "border-t border-base-200" : ""}`}>
                    <div className="flex w-full min-w-0 items-center gap-3">
                      {bulkMode ? <input className="checkbox checkbox-sm mt-0.5 shrink-0" type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} /> : null}
                      <div className="w-full min-w-0">
                        <div className="block truncate text-sm text-base-content" title={item.title}>
                          {item.title}
                        </div>
                        <div className="block truncate text-xs text-base-content/60" title={item.url}>
                          {item.url}
                        </div>
                      </div>
                    </div>
                    {!bulkMode ? (
                      <div className="inline-flex items-center gap-2 whitespace-nowrap">
                        <button type="button" className="btn btn-link btn-sm px-1" onClick={() => openFormModal("edit", item)}>
                          编辑
                        </button>
                        <button type="button" className="btn btn-link btn-sm px-1 text-error" onClick={() => openDeleteModal(item)}>
                          删除
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 text-xs text-base-content/60">没有匹配的书签，请调整筛选条件</div>
            )}
          </div>
        </section>
      </div>
      <FormModal
        title={formMode === "add" ? "新增书签" : "编辑书签"}
        mounted={formModalMounted}
        open={formModalOpen}
        confirmText={formMode === "add" ? "添加" : "保存"}
        disableConfirm={!canSubmit}
        onClose={closeFormModal}
        onConfirm={onSaveForm}
      >
        <input className="input w-full" value={formTitle} placeholder="名称，如：GitHub" onChange={(event) => setFormTitle(event.target.value)} />
        <input className="input w-full" value={formUrl} placeholder="链接，如：github.com" onChange={(event) => setFormUrl(event.target.value)} />
      </FormModal>
      <ConfirmModal
        title="删除书签"
        description={deleteTarget ? `确认删除“${deleteTarget.title}”吗？删除后将无法恢复。` : ""}
        mounted={confirmModalMounted}
        open={confirmModalOpen}
        confirmText="删除"
        onClose={closeDeleteModal}
        onConfirm={onConfirmDelete}
      />
      <ConfirmModal
        title="批量删除书签"
        description={`确认删除已选中的 ${selectedIds.size} 项书签吗？删除后将无法恢复。`}
        mounted={bulkConfirmModalMounted}
        open={bulkConfirmModalOpen}
        confirmText="删除所选"
        onClose={closeBulkDeleteModal}
        onConfirm={onConfirmBulkDelete}
      />
    </div>
  );
}
