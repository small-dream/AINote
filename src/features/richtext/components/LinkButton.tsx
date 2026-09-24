import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/i18n";
import { Tooltip } from "@/components/atoms/Tooltip";
import { LinkPopover, type LinkPopoverRequest } from "@/components/molecules/LinkPopover";
import { LINK_INPUT_EVENT, normalizeLinkUrl } from "../utils/linkUrl";
import { LINK_COMMAND } from "../utils/toolbarCommands";

interface LinkButtonProps {
  editor: Editor;
  /** bubble = 气泡菜单按钮（7 格）；toolbar = 格式工具栏按钮（8 格带边框） */
  variant: "bubble" | "toolbar";
  /** 工具栏内被 overflow 滚动容器裁剪时开启，气泡 portal 到 body */
  tooltipPortal?: boolean;
}

/** 链接按钮：未激活点击弹出 URL 输入，已激活点击解除链接；同时响应 Mod-k / 斜杠命令的事件请求 */
export function LinkButton({ editor, variant, tooltipPortal = false }: LinkButtonProps) {
  const { t } = useTranslation();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const link = useLinkInput(editor, buttonRef);
  const active = editor.isActive("link");
  const label = active ? t("richtext.removeLink") : t(LINK_COMMAND.labelKey);
  return (
    <>
      <Tooltip content={label} portal={tooltipPortal}>
        <button
          ref={buttonRef}
          type="button"
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
      </Tooltip>
      <LinkPopover request={link.request} anchorRect={link.anchorRect} />
    </>
  );
}

interface LinkInputState {
  request: LinkPopoverRequest | null;
  anchorRect: DOMRect | null;
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
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setInvalid(false);
    // 气泡菜单隐藏时按钮 visibility:hidden 无法聚焦，focus 无效后回退编辑器
    buttonRef.current?.focus();
    if (document.activeElement !== buttonRef.current) editor.commands.focus();
  }, [editor, buttonRef]);

  const openInput = useCallback(() => {
    setValue(String(editor.getAttributes("link").href ?? ""));
    setAnchorRect(buttonRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  }, [buttonRef, editor]);

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

  const request = open ? {
    value,
    invalid,
    onChange: (next: string) => { setValue(next); setInvalid(false); },
    onSubmit: submit,
    onRemove: () => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); close(); },
    onClose: close,
  } satisfies LinkPopoverRequest : null;
  return { request, anchorRect, value, invalid, setValue: (v) => { setValue(v); setInvalid(false); }, openInput, close, submit };
}

function buttonClass(variant: "bubble" | "toolbar", active: boolean): string {
  if (variant === "bubble") {
    return `grid h-7 w-7 place-items-center rounded-md transition-colors ${active ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`;
  }
  return `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${active ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary"}`;
}
