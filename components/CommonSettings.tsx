import { move } from "@dnd-kit/helpers";
import { createPortal } from "react-dom";
import { DragDropProvider } from "@dnd-kit/react";
import { useStorage } from "@plasmohq/storage/hook";
import { directionBiased } from "@dnd-kit/collision";
import { useSortable } from "@dnd-kit/react/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageDb } from "~indexedDB/ImageDB";
import { useCommonLinks } from "~hooks/useLinks";
import { ConfirmModal, FormModal } from "~components/Modal";
import { commonSwitchKey, getBIS, local } from "~storage/local";
import { addCommonLink, removeCommonLink, replaceCommonLinks, updateCommonLink } from "~indexedDB/LinksDB";
import { createCommonId, getCommonExportFileName, normalizeUrl, parseCommonLinksJson, regenerateCommonIds, serializeCommonLinks } from "~utils/link";
import type { DragDropEventHandlers } from "@dnd-kit/react";
import type { CommonLink } from "~indexedDB/LinksDB";

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

type CommonFormMode = "add" | "edit";

interface CommonSettingsProps {
  sortModalOpen: boolean;
  onOpenSortModal: () => void;
  onCloseSortModal: () => void;
}

export function CommonSettings(props: CommonSettingsProps) {
  const { sortModalOpen, onOpenSortModal, onCloseSortModal } = props;
  const [commonSwitch, setCommonSwitch] = useStorage({ instance: local, key: commonSwitchKey }, false);
  const { items: commonLinks } = useCommonLinks();
  const [filterTitle, setFilterTitle] = useState("");
  const [filterUrl, setFilterUrl] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formMode, setFormMode] = useState<CommonFormMode>("add");
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formModalMounted, setFormModalMounted] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommonLink | undefined>(undefined);
  const [confirmModalMounted, setConfirmModalMounted] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [bulkConfirmModalMounted, setBulkConfirmModalMounted] = useState(false);
  const [bulkConfirmModalOpen, setBulkConfirmModalOpen] = useState(false);
  const [sortPreviewBgUrl, setSortPreviewBgUrl] = useState<string | undefined>(undefined);
  const [sortPreviewBgLoading, setSortPreviewBgLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>(undefined);
  const sortPreviewBgObjectUrlRef = useRef<string | undefined>(undefined);
  const formModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bulkConfirmModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(() => formTitle.trim().length > 0 && formUrl.trim().length > 0, [formTitle, formUrl]);
  const filteredCommonLinks = useMemo(() => {
    const normalizedTitle = filterTitle.trim().toLowerCase();
    const normalizedUrl = filterUrl.trim().toLowerCase();

    return commonLinks.filter((item) => {
      const matchesTitle = !normalizedTitle || item.title.toLowerCase().includes(normalizedTitle);
      const matchesUrl = !normalizedUrl || item.url.toLowerCase().includes(normalizedUrl);
      return matchesTitle && matchesUrl;
    });
  }, [commonLinks, filterTitle, filterUrl]);
  const filteredCommonIds = useMemo(() => filteredCommonLinks.map((item) => item.id), [filteredCommonLinks]);
  const hasFilteredCommonLinks = filteredCommonIds.length > 0;
  const allFilteredCommonSelected = hasFilteredCommonLinks && filteredCommonIds.every((id) => selectedIds.has(id));

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

  const openFormModal = (mode: CommonFormMode, item?: CommonLink) => {
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

  const openDeleteModal = (item: CommonLink) => {
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
      if (allFilteredCommonSelected) {
        filteredCommonIds.forEach((id) => {
          next.delete(id);
        });
      } else {
        filteredCommonIds.forEach((id) => {
          next.add(id);
        });
      }
      return next;
    });
  };

  const onSaveForm = async () => {
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

    if (formMode === "add") {
      const exists = commonLinks.some((item) => item.url === nextUrl);
      if (exists) {
        setNoticeText("warning", "该常用链接已存在");
        return;
      }
    }

    if (formMode === "edit" && editingId) {
      const exists = commonLinks.some((item) => item.id !== editingId && item.url === nextUrl);
      if (exists) {
        setNoticeText("warning", "该常用链接已存在");
        return;
      }

      try {
        await updateCommonLink(editingId, {
          title: nextTitle,
          url: nextUrl
        });
        closeFormModal();
        setNoticeText("success", "已更新常用");
      } catch {
        setNoticeText("error", "保存失败，请稍后重试");
      }
      return;
    }

    try {
      await addCommonLink({
        id: createCommonId(),
        title: nextTitle,
        url: nextUrl
      });
      closeFormModal();
      setNoticeText("success", "已添加到常用");
    } catch {
      setNoticeText("error", "保存失败，请稍后重试");
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await removeCommonLink(deleteTarget.id);
      closeDeleteModal();
      setNoticeText("success", "已从常用中删除");
    } catch {
      setNoticeText("error", "删除失败，请稍后重试");
    }
  };

  const onConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    try {
      const nextLinks = commonLinks.filter((item) => !selectedIds.has(item.id));
      await replaceCommonLinks(nextLinks);
      closeBulkDeleteModal();
      const deletedCount = selectedIds.size;
      exitBulkMode();
      setNoticeText("success", `已删除 ${deletedCount} 项常用`);
    } catch {
      setNoticeText("error", "删除失败，请稍后重试");
    }
  };

  const onSortEnd: NonNullable<DragDropEventHandlers["onDragEnd"]> = (event) => {
    void replaceCommonLinks(move(commonLinks, event)).catch(() => {
      setNoticeText("error", "排序失败，请稍后重试");
    });
  };

  const onExport = () => {
    const payload = serializeCommonLinks(commonLinks);
    const exportBlob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const exportUrl = URL.createObjectURL(exportBlob);
    const link = document.createElement("a");
    link.href = exportUrl;
    link.download = getCommonExportFileName();
    link.click();
    URL.revokeObjectURL(exportUrl);
    setNoticeText("success", "已导出常用 JSON");
  };

  const onImport = async (file?: File) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const importedLinks = regenerateCommonIds(parseCommonLinksJson(text));
      if (importedLinks.length === 0) {
        setNoticeText("info", "导入成功，但没有新增常用");
        return;
      }

      await replaceCommonLinks([...commonLinks, ...importedLinks]);
      setCommonSwitch(true);
      setNoticeText("success", `已导入 ${importedLinks.length} 项常用`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败，请检查 JSON 文件";
      setNoticeText("error", message);
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  useEffect(() => {
    const validIds = new Set(commonLinks.map((item) => item.id));
    setSelectedIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [commonLinks]);

  useEffect(() => {
    const clearPreviewBackground = () => {
      if (sortPreviewBgObjectUrlRef.current) {
        URL.revokeObjectURL(sortPreviewBgObjectUrlRef.current);
        sortPreviewBgObjectUrlRef.current = undefined;
      }
      setSortPreviewBgUrl(undefined);
    };

    if (!sortModalOpen) {
      setSortPreviewBgLoading(false);
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
  }, [sortModalOpen]);

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

  return (
    <div className="relative flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2 pb-1">
        <strong className="text-sm font-bold text-base-content">常用</strong>
        <div className="flex items-center gap-1">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            name="common-import-file"
            className="hidden"
            onChange={(event) => {
              void onImport(event.target.files?.[0]);
            }}
          />
          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => importInputRef.current?.click()}>
              导入
            </button>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={onExport}>
              导出
            </button>
            <label className="inline-flex items-center gap-2 text-xs text-base-content/70">
              <input className="toggle toggle-sm" type="checkbox" checked={commonSwitch} onChange={(event) => setCommonSwitch(event.target.checked)} />
            </label>
          </div>
        </div>
      </div>
      {notice ? (
        <div role="alert" className={`alert alert-soft text-sm ${noticeClassNameMap[notice.type]}`}>
          <span>{notice.text}</span>
        </div>
      ) : null}
      <div className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <span className="text-xs text-base-content/60">{bulkMode ? `已选 ${selectedIds.size} 项` : `显示 ${filteredCommonLinks.length} / 共 ${commonLinks.length} 项`}</span>
          <div className="flex items-center gap-2">
            {bulkMode ? (
              <>
                <button type="button" className="btn btn-link btn-sm px-1" disabled={!hasFilteredCommonLinks} onClick={toggleSelectAllFiltered}>
                  {allFilteredCommonSelected ? "取消当前所有" : "勾选当前所有"}
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
                  添加
                </button>
                <button type="button" className="btn btn-link btn-sm px-1 text-error" disabled={commonLinks.length === 0 || sortModalOpen} onClick={() => setBulkMode(true)}>
                  批量删除
                </button>
                <button type="button" className="btn btn-link btn-sm px-1" disabled={commonLinks.length < 2} onClick={onOpenSortModal}>
                  排序
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pb-3">
          <input
            id="common-filter-title"
            name="common-filter-title"
            className="input min-w-44 flex-1"
            value={filterTitle}
            placeholder="搜索名称"
            onChange={(event) => setFilterTitle(event.target.value)}
          />
          <input
            id="common-filter-url"
            name="common-filter-url"
            className="input min-w-56 basis-56 grow"
            value={filterUrl}
            placeholder="搜索链接"
            onChange={(event) => setFilterUrl(event.target.value)}
          />
        </div>
        {commonLinks.length === 0 ? (
          <div className="py-3 text-xs text-base-content/60">暂无常用，请先添加链接</div>
        ) : filteredCommonLinks.length > 0 ? (
          <div className="flex flex-col">
            {filteredCommonLinks.map((item, index) => (
              <LinkItem
                key={item.id}
                item={item}
                index={index}
                bulkMode={bulkMode}
                selected={selectedIds.has(item.id)}
                onToggleSelected={() => toggleSelected(item.id)}
                onEdit={() => openFormModal("edit", item)}
                onDelete={() => openDeleteModal(item)}
              />
            ))}
          </div>
        ) : (
          <div className="py-3 text-xs text-base-content/60">没有匹配的常用链接，请调整筛选条件</div>
        )}
      </div>
      <FormModal
        title={formMode === "add" ? "新增常用" : "编辑常用"}
        mounted={formModalMounted}
        open={formModalOpen}
        confirmText={formMode === "add" ? "添加" : "保存"}
        disableConfirm={!canSubmit}
        onClose={closeFormModal}
        onConfirm={() => {
          void onSaveForm();
        }}
      >
        <input id="common-form-title" name="common-form-title" className="input w-full" value={formTitle} placeholder="名称，如：GitHub" onChange={(event) => setFormTitle(event.target.value)} />
        <input id="common-form-url" name="common-form-url" className="input w-full" value={formUrl} placeholder="链接，如：github.com" onChange={(event) => setFormUrl(event.target.value)} />
      </FormModal>
      <ConfirmModal
        title="删除常用"
        description={deleteTarget ? `确认删除“${deleteTarget.title}”吗？删除后将无法恢复。` : ""}
        mounted={confirmModalMounted}
        open={confirmModalOpen}
        confirmText="删除"
        onClose={closeDeleteModal}
        onConfirm={() => {
          void onConfirmDelete();
        }}
      />
      <ConfirmModal
        title="批量删除常用"
        description={`确认删除已选中的 ${selectedIds.size} 项常用吗？删除后将无法恢复。`}
        mounted={bulkConfirmModalMounted}
        open={bulkConfirmModalOpen}
        confirmText="删除所选"
        onClose={closeBulkDeleteModal}
        onConfirm={() => {
          void onConfirmBulkDelete();
        }}
      />
      {typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden={!sortModalOpen}
              className={`fixed inset-0 z-50 overflow-hidden bg-cover bg-center bg-no-repeat transition-all duration-200 ease-out ${
                sortModalOpen ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0"
              }`}
              style={sortPreviewBgUrl ? { backgroundImage: `url(${sortPreviewBgUrl})` } : undefined}
            >
              {!sortPreviewBgUrl ? (
                <div className={`absolute inset-0 bg-linear-to-b from-slate-900/55 to-slate-900/75 transition-opacity duration-200 ease-out ${sortModalOpen ? "opacity-100" : "opacity-0"}`} />
              ) : null}
              <div
                className={`absolute left-0 right-0 top-3.5 z-20 flex justify-center px-4 transition-all duration-200 ease-out md:px-0 ${
                  sortModalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
                }`}
              >
                <button
                  type="button"
                  tabIndex={sortModalOpen ? 0 : -1}
                  className="btn rounded-full border-0 bg-slate-900/70 px-4 text-sm text-slate-50 shadow-xl hover:bg-slate-900/80"
                  onClick={onCloseSortModal}
                >
                  退出排序
                </button>
              </div>
              <div
                className={`relative z-10 flex h-full w-full items-center justify-center p-6 pt-16 transition-all duration-200 ease-out max-md:min-h-screen max-md:items-start max-md:p-4 ${
                  sortModalOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
                }`}
              >
                {commonLinks.length > 0 ? (
                  <DragDropProvider onDragEnd={onSortEnd}>
                    <div className="common-links-grid">
                      {commonLinks.map((item, index) => (
                        <SortablePreviewCard key={item.id} item={item} index={index} />
                      ))}
                    </div>
                  </DragDropProvider>
                ) : (
                  <div className="py-3 text-xs text-slate-200">暂无常用，请先添加链接</div>
                )}
              </div>
              {sortPreviewBgLoading ? <div className="absolute bottom-2.5 right-2.5 z-20 rounded-full bg-slate-900/55 px-2 py-1 text-xs text-slate-50">背景图加载中...</div> : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

interface LinkItemProps {
  item: CommonLink;
  index: number;
  bulkMode: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function LinkItem(props: LinkItemProps) {
  const { item, index, bulkMode, selected, onToggleSelected, onEdit, onDelete } = props;

  return (
    <div className={`flex cursor-default justify-between gap-3 py-2.5 ${index > 0 ? "border-t border-base-200" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {bulkMode ? <input className="checkbox checkbox-sm mt-0.5 shrink-0" type="checkbox" checked={selected} onChange={onToggleSelected} /> : null}
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
        <div className="inline-flex items-center gap-2.5 whitespace-nowrap">
          <button type="button" className="btn btn-link btn-sm px-1" onClick={onEdit}>
            编辑
          </button>
          <button type="button" className="btn btn-link btn-sm px-1 text-error" onClick={onDelete}>
            删除
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface SortablePreviewCardProps {
  item: CommonLink;
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
      className={`card cursor-grab select-none justify-center rounded-2xl bg-slate-900/45 text-white shadow-lg shadow-slate-950/15 backdrop-blur-md transition duration-150 active:cursor-grabbing ${
        isDragSource || isDragging ? "scale-105 bg-slate-900/60 shadow-xl shadow-slate-950/25" : ""
      } ${isDropping ? "scale-95" : ""}`}
      style={{ height: "100%" }}
    >
      <div className="card-body gap-1.5 px-4 py-3.5">
        <span className="truncate text-base font-bold">{item.title}</span>
        <span className="truncate text-xs opacity-90">{item.url}</span>
      </div>
    </div>
  );
}
