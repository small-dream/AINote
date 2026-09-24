import { Eraser } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import { TEXT_STYLE_SPECS, optionLabelKey, textStyleClass, type TextStyleKind } from "../utils/textStyles";

interface SwatchGridProps {
  kind: Extract<TextStyleKind, "color" | "mark">;
  /** 当前生效档位；null 表示未设样式 */
  activeValue: string | null;
  onSelect: (value: string) => void;
  onClear: () => void;
}

const buttonClass = (active: boolean): string =>
  `grid h-9 w-9 place-items-center rounded-md border transition-[border-color,transform] duration-150 active:scale-[0.94] sm:h-7 sm:w-7 ${active ? "border-accent" : "border-border hover:border-accent/50"}`;

/** 颜色 / 高亮的色板：色点直接复用内容样式 class，预览与正文取值必然一致（含主题派生）。 */
export function SwatchGrid({ kind, activeValue, onSelect, onClear }: SwatchGridProps) {
  const { t } = useTranslation();
  const spec = TEXT_STYLE_SPECS[kind];
  return (
    <div className="flex flex-wrap items-center gap-1 px-1">
      {spec.values.map((value) => {
        const marker = textStyleClass(kind, value) ?? "";
        const key = optionLabelKey(kind, value);
        const label = key ? t(key) : value;
        return (
          <Tooltip key={value} content={label}>
            <button type="button" aria-label={label} aria-pressed={activeValue === value} className={buttonClass(activeValue === value)} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(value)}>
              <span className={`block h-4 w-4 rounded-full ${kind === "color" ? `${marker} bg-current` : marker}`} />
            </button>
          </Tooltip>
        );
      })}
      <Tooltip content={t(spec.clearLabelKey)}>
        <button type="button" aria-label={t(spec.clearLabelKey)} className={buttonClass(false)} onMouseDown={(event) => event.preventDefault()} onClick={onClear}>
          <Eraser size={14} strokeWidth={1.9} className="text-text-secondary" aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
  );
}
