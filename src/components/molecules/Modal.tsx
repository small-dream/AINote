import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackHandler } from "@/platform/back-navigation";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  noteTheme?: string;
  /** 移动端是否以底部弹层呈现（默认 true）；传 false 时保持居中对话框 */
  mobileSheet?: boolean;
}

/** 通用模态框：ESC / 系统返回键 / 遮罩点击关闭 + dialog 语义（P2 可访问性） */
export function Modal({ open, title, onClose, children, className = "", noteTheme, mobileSheet = true }: ModalProps) {
  useBackHandler(open, onClose);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      data-modal-sheet={mobileSheet ? "true" : undefined}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ainote-modal-title"
        data-note-theme={noteTheme}
        className={`w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-lg ${className}`}
      >
        <h2 id="ainote-modal-title" className="mb-4 text-lg font-semibold">
          {title}
        </h2>
      {children}
      </div>
    </div>,
    document.body
  );
}
