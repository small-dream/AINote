import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";

const OPTIONS = [
  { level: 0, labelKey: "note.body" },
  { level: 1, labelKey: "H1" },
  { level: 2, labelKey: "H2" },
  { level: 3, labelKey: "H3" },
] as const;

type HeadingLevel = (typeof OPTIONS)[number]["level"];
type Option = (typeof OPTIONS)[number];

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

  const current = OPTIONS.find((o) => o.level > 0 && active.has(`h${o.level}`)) ?? OPTIONS[0];
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("note.headingLevel")}
        title={t("note.headingLevel")}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 items-center gap-0.5 rounded-md px-2 text-xs transition-colors duration-120 ${
          current.level > 0
            ? "bg-accent-soft text-accent"
            : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
        }`}
      >
        {current.labelKey === "H1" ? "H1" : current.labelKey === "H2" ? "H2" : current.labelKey === "H3" ? "H3" : t(current.labelKey)}
        <ChevronDown size={12} />
      </button>
      {open ? createPortal(
        <MenuList
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

function MenuList({ current, position, menuRef, onPick }: { current: Option; position: CSSProperties; menuRef: RefObject<HTMLUListElement | null>; onPick: (l: HeadingLevel) => void }) {
  const { t } = useTranslation();
  const itemClass = (o: Option) =>
    `block w-full px-3 py-1.5 text-left text-xs transition-colors duration-120 ${
      o.level === current.level
        ? "bg-accent-soft text-accent"
        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
    }`;
  return (
    <ul ref={menuRef} style={position} className="fixed z-50 min-w-20 rounded-md border border-border bg-bg-primary py-1 shadow-md">
      {OPTIONS.map((o) => (
        <li key={o.level}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(o.level)}
            className={itemClass(o)}
          >
            {o.labelKey === "H1" ? "H1" : o.labelKey === "H2" ? "H2" : o.labelKey === "H3" ? "H3" : t(o.labelKey)}
          </button>
        </li>
      ))}
    </ul>
  );
}
