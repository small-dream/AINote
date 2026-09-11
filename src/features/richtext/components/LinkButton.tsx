import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/i18n";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { LINK_INPUT_EVENT, normalizeLinkUrl } from "../utils/linkUrl";
import { LINK_COMMAND } from "../utils/toolbarCommands";

const POPOVER_WIDTH = 280;

interface LinkButtonProps {
  editor: Editor;
  /** bubble = 气泡菜单按钮（7 格）；toolbar = 格式工具栏按钮（8 格带边框） */
  variant: "bubble" | "toolbar";
}

/** 链接按钮：未激活点击弹出 URL 输入，已激活点击解除链接；同时响应 Mod-k / 斜杠命令的事件请求 */
export function LinkButton({ editor, variant }: LinkButtonProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const link = useLinkInput(editor, buttonRef);
  const active = editor.isActive("link");
  const label = active ? t("richtext.removeLink") : t(LINK_COMMAND.labelKey);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={label}
        aria-label={label}
        aria-pressed={active}
        className={buttonClass(variant, active)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          link.openInput();
        }}
      >
        <LINK_COMMAND.icon size={variant === "bubble" ? 15 : 16} strokeWidth={1.9} aria-hidden="true" />
      </button>
      <LinkUrlPopover anchorRef={buttonRef} link={link} />
    </>
  );
}

interface LinkInputState {
  open: boolean;
  value: string;
  invalid: boolean;
  setValue: (value: string) => void;
  openInput: () => void;
  close: () => void;
  submit: () => void;
}

/** 链接输入状态：打开时预填已有 href，Enter 校验写入，Esc/外点关闭（useAnchoredLayer 处理） */
function useLinkInput(editor: Editor, buttonRef: React.RefObject<HTMLButtonElement | null>): LinkInputState {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setInvalid(false);
    // 气泡菜单隐藏时按钮 visibility:hidden 无法聚焦，focus 无效后回退编辑器
    buttonRef.current?.focus();
    if (document.activeElement !== buttonRef.current) editor.commands.focus();
  }, [editor, buttonRef]);

  const openInput = useCallback(() => {
    setValue(String(editor.getAttributes("link").href ?? ""));
    setOpen(true);
  }, [editor]);

  const submit = useCallback(() => {
    const href = value.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      close();
      return;
    }
    const normalized = normalizeLinkUrl(href);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    close();
  }, [value, editor, close]);

  // Mod-k / 斜杠命令经 LINK_INPUT_EVENT 请求打开；stopImmediatePropagation 保证
  // 工具栏与气泡菜单里的两个 LinkButton 只有一个响应
  useEffect(() => {
    const onRequest = (event: Event) => {
      event.stopImmediatePropagation();
      openInput();
    };
    window.addEventListener(LINK_INPUT_EVENT, onRequest);
    return () => window.removeEventListener(LINK_INPUT_EVENT, onRequest);
  }, [openInput]);

  return { open, value, invalid, setValue: (v) => { setValue(v); setInvalid(false); }, openInput, close, submit };
}

function LinkUrlPopover({ anchorRef, link }: { anchorRef: React.RefObject<HTMLButtonElement | null>; link: LinkInputState }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { menuRef, position } = useAnchoredLayer({ triggerRef: anchorRef, open: link.open, close: link.close, width: POPOVER_WIDTH });
  useEffect(() => {
    if (link.open) inputRef.current?.focus();
  }, [link.open]);
  if (!link.open) return null;
  return createPortal(
    <div
      ref={menuRef}
      role="dialog"
      aria-label={t("note.link")}
      style={{ ...position, position: "fixed", zIndex: 50, width: POPOVER_WIDTH }}
      className="rounded-lg border border-border bg-bg-primary p-2 shadow-lg"
    >
      <input
        ref={inputRef}
        value={link.value}
        onChange={(event) => link.setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            link.submit();
          }
        }}
        placeholder={t("richtext.linkPlaceholder")}
        aria-invalid={link.invalid}
        aria-label={t("richtext.linkPlaceholder")}
        className="h-8 w-full rounded-md border border-border bg-bg-secondary px-2 text-sm text-text-primary outline-none focus:border-accent"
      />
      {link.invalid ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">{t("richtext.linkInvalid")}</p>
      ) : null}
    </div>,
    document.body
  );
}

function buttonClass(variant: "bubble" | "toolbar", active: boolean): string {
  if (variant === "bubble") {
    return `grid h-7 w-7 place-items-center rounded-md transition-colors ${active ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`;
  }
  return `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${active ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary"}`;
}
