import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import type { HeadingLevel } from "../utils/format";

const LEVELS = [0, 1, 2, 3, 4, 5, 6] as const;

interface HeadingOption {
  level: HeadingLevel;
  label: string;
}

const MENU_WIDTH = 96;

interface HeadingDropdownProps {
  active: Set<string>;
  onSelect: (level: HeadingLevel) => void;
}

/** 标题级别下拉：portal 到 body 定位，避免被工具栏滚动容器裁剪 */
export function HeadingDropdown({ active, onSelect }: HeadingDropdownProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { menuRef, position } = useAnchoredLayer<HTMLUListElement>({ triggerRef: rootRef, open, close: () => setOpen(false), width: MENU_WIDTH, align: "start" });

  const options: HeadingOption[] = LEVELS.map((level) => ({ level, label: level === 0 ? t("note.body") : `H${level}` }));
  const fallback: HeadingOption = { level: 0, label: t("note.body") };
  const current = options.find((option) => option.level > 0 && active.has(`h${option.level}`)) ?? fallback;
  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={t("note.headingLevel")} placement="bottom">
        <button
          type="button"
          aria-label={t("note.headingLevel")}
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-7 items-center gap-0.5 rounded-md px-2 text-xs transition-colors duration-120 ${
            current.level > 0
              ? "bg-accent-soft text-accent"
              : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          }`}
        >
          {current.label}
          <ChevronDown size={12} />
        </button>
      </Tooltip>
      {open ? createPortal(
        <MenuList
          options={options}
          current={current}
          position={position}
          menuRef={menuRef}
          onPick={(level) => {
            onSelect(level);
            setOpen(false);
          }}
        />,
        document.body,
      ) : null}
    </div>
  );
}

function MenuList({ options, current, position, menuRef, onPick }: { options: HeadingOption[]; current: HeadingOption; position: CSSProperties; menuRef: RefObject<HTMLUListElement | null>; onPick: (l: HeadingLevel) => void }) {
  const itemClass = (level: HeadingLevel) =>
    `block w-full px-3 py-1.5 text-left text-xs transition-colors duration-120 ${
      level === current.level
        ? "bg-accent-soft text-accent"
        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
    }`;
  return (
    <ul ref={menuRef} style={position} className="fixed z-50 min-w-20 rounded-md border border-border bg-bg-primary py-1 shadow-md">
      {options.map((option) => (
        <li key={option.level}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(option.level)}
            className={itemClass(option.level)}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
