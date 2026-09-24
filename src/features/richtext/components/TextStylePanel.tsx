import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Baseline, type LucideIcon } from "lucide-react";
import type { Editor } from "@tiptap/core";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import type { TranslationKey } from "@/i18n/messages";
import { TextStyleOptions } from "./TextStyleOptions";
import { TEXT_STYLE_KINDS, type TextStyleKind } from "../utils/textStyles";

interface TextStylePanelProps {
  editor: Editor | null;
  /** 只展示指定分组：工具栏给全部四组，气泡菜单只给高亮 / 颜色 */
  kinds?: readonly TextStyleKind[];
  icon?: LucideIcon;
  labelKey?: TranslationKey;
  /** 工具栏内被 overflow 容器裁剪时开启，触发按钮的气泡 portal 到 body */
  tooltipPortal?: boolean;
  onApplied?: (() => void) | undefined;
}

/** 字符级样式的统一入口（「Aa」面板）：字体 / 字号 / 颜色 / 高亮四组同屏，选完不收起，便于连续设置。
 * 面板 portal 到 body，必须自带 data-note-theme 与 note-theme-surface，否则取不到当前阅读主题的 token。 */
const PANEL_WIDTH = 236;

export function TextStylePanel({ editor, kinds = TEXT_STYLE_KINDS, icon: Icon = Baseline, labelKey = "richtext.textStyle", tooltipPortal = false, onApplied }: TextStylePanelProps) {
  const { t } = useTranslation();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { menuRef, position } = useAnchoredLayer({ triggerRef: containerRef, open, close: () => setOpen(false), width: PANEL_WIDTH, align: "start" });

  if (!editor) return null;
  const label = t(labelKey);
  const trigger = open ? "border-accent/30 bg-accent-soft text-accent" : "border-transparent text-text-secondary hover:border-border hover:bg-bg-tertiary hover:text-text-primary";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Tooltip content={label} placement="bottom" portal={tooltipPortal}>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] ${trigger}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </Tooltip>
      {open ? createPortal(
        <div ref={menuRef} role="dialog" aria-label={label} data-note-theme={noteTheme} style={position} className="note-theme-surface fixed z-50 rounded-xl border border-border bg-bg-primary p-2 shadow-xl">
          {kinds.map((kind) => <TextStyleOptions key={kind} editor={editor} kind={kind} onApplied={onApplied} />)}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
