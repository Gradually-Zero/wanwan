import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { PropsWithChildren, ReactNode } from "react";

interface ModalShellProps extends PropsWithChildren {
  title: string;
  mounted: boolean;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}

export interface FormModalProps extends PropsWithChildren {
  title: string;
  mounted: boolean;
  open: boolean;
  confirmText: string;
  cancelText?: string;
  loading?: boolean;
  disableConfirm?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface ConfirmModalProps {
  title: string;
  description: string;
  mounted: boolean;
  open: boolean;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  confirmVariant?: "primary" | "error";
  onClose: () => void;
  onConfirm: () => void;
}

function ModalShell(props: ModalShellProps) {
  const { title, mounted, open, onClose, footer, children } = props;

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-60 flex items-center justify-center p-4 transition-all duration-200 ease-out ${
        open ? "pointer-events-auto bg-neutral/45 opacity-100" : "pointer-events-none bg-neutral/0 opacity-0"
      }`}
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`w-full max-w-lg rounded-3xl border border-base-300 bg-base-100 shadow-2xl transition-all duration-200 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-base-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-base-content">{title}</h2>
          <button type="button" className="btn btn-ghost btn-circle" aria-label="关闭弹窗" onClick={onClose}>
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-base-200 px-5 py-4">{footer}</div> : null}
      </section>
    </div>,
    document.body
  );
}

export function FormModal(props: FormModalProps) {
  const { title, mounted, open, confirmText, cancelText = "取消", loading = false, disableConfirm = false, onClose, onConfirm, children } = props;

  return (
    <ModalShell
      title={title}
      mounted={mounted}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button type="submit" className="btn btn-primary" form={`modal-form-${title}`} disabled={disableConfirm || loading}>
            {loading ? "提交中..." : confirmText}
          </button>
        </>
      }
    >
      <form
        id={`modal-form-${title}`}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        {children}
      </form>
    </ModalShell>
  );
}

export function ConfirmModal(props: ConfirmModalProps) {
  const { title, description, mounted, open, confirmText = "确认删除", cancelText = "取消", loading = false, confirmVariant = "error", onClose, onConfirm } = props;

  return (
    <ModalShell
      title={title}
      mounted={mounted}
      open={open}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {cancelText}
          </button>
          <button type="button" className={`btn ${confirmVariant === "error" ? "btn-error" : "btn-primary"}`} disabled={loading} onClick={onConfirm}>
            {loading ? "处理中..." : confirmText}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-base-content/80">{description}</p>
    </ModalShell>
  );
}
