import type { Editor } from "@tiptap/core";
import { useTranslation } from "@/i18n";
import { SwatchGrid } from "./SwatchGrid";
import { activeTextStyle, clearTextStyle, toggleTextStyle } from "../utils/textStyleCommands";
import { TEXT_STYLE_SPECS, effectiveTextStyle, optionLabelKey, type TextStyleKind } from "../utils/textStyles";

interface TextStyleOptionsProps {
  editor: Editor;
  kind: TextStyleKind;
  /** 应用样式后回调（气泡菜单据此收起自身） */
  onApplied?: (() => void) | undefined;
}

/** 单组样式的控件行：字体 / 字号为文字档位按钮，颜色 / 高亮为色板。 */
export function TextStyleOptions({ editor, kind, onApplied }: TextStyleOptionsProps) {
  const { t } = useTranslation();
  const spec = TEXT_STYLE_SPECS[kind];
  const active = effectiveTextStyle(kind, activeTextStyle(editor, kind));
  const apply = (run: () => void): void => {
    run();
    onApplied?.();
  };
  return (
    <section className="mb-2 last:mb-0">
      <h3 className="mb-1 px-1 text-[11px] font-medium text-text-secondary">{t(spec.labelKey)}</h3>
      {spec.control === "swatch" ? (
        <SwatchGrid
          kind={kind === "mark" ? "mark" : "color"}
          activeValue={active}
          onSelect={(value) => apply(() => toggleTextStyle(editor, kind, value))}
          onClear={() => apply(() => clearTextStyle(editor, kind))}
        />
      ) : (
        <div className="flex flex-wrap gap-1 px-1">
          {spec.values.map((value) => {
            const key = optionLabelKey(kind, value);
            const label = key ? t(key) : value;
            return (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={active === value}
                className={`h-9 min-w-9 rounded-md border px-2 text-xs transition-[background-color,border-color,color] duration-150 sm:h-7 ${active === value ? "border-accent/30 bg-accent-soft text-accent" : "border-border text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => apply(() => toggleTextStyle(editor, kind, value))}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
