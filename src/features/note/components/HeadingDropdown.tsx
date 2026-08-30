import { useEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown } from "lucide-react";

const OPTIONS = [
  { level: 0, label: "正文" },
  { level: 1, label: "H1" },
  { level: 2, label: "H2" },
  { level: 3, label: "H3" },
] as const;

type HeadingLevel = (typeof OPTIONS)[number]["level"];
type Option = (typeof OPTIONS)[number];

interface HeadingDropdownProps {
  active: Set<string>;
  onSelect: (level: HeadingLevel) => void;
}

/** 标题级别下拉：按钮显示当前行级别，点击外部 / Escape 关闭 */
export function HeadingDropdown({ active, onSelect }: HeadingDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useCloseOnOutside(rootRef, open, () => setOpen(false));

  const current = OPTIONS.find((o) => o.level > 0 && active.has(`h${o.level}`)) ?? OPTIONS[0];
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="标题级别"
        title="标题级别"
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
      {open && (
        <MenuList
          current={current}
          onPick={(level) => {
            onSelect(level);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function MenuList({ current, onPick }: { current: Option; onPick: (l: HeadingLevel) => void }) {
  const itemClass = (o: Option) =>
    `block w-full px-3 py-1.5 text-left text-xs transition-colors duration-120 ${
      o.level === current.level
        ? "bg-accent-soft text-accent"
        : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
    }`;
  return (
    <ul className="absolute left-0 top-full z-10 mt-1 min-w-20 overflow-hidden rounded-md border border-border bg-bg-primary py-1 shadow-md">
      {OPTIONS.map((o) => (
        <li key={o.level}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(o.level)}
            className={itemClass(o)}
          >
            {o.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function useCloseOnOutside(
  rootRef: RefObject<HTMLDivElement | null>,
  open: boolean,
  close: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [rootRef, open, close]);
}
