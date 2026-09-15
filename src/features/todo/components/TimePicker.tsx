import { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "@/i18n";

const ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 7;
const LIST_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
/** 首尾占位，让第一项与最后一项也能滚到中线 */
const LIST_PAD = (LIST_HEIGHT - ITEM_HEIGHT) / 2;
/** 上下渐隐：略大于一行，提示还有更多 */
const FADE_HEIGHT = ITEM_HEIGHT * 1.5;

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

interface TimePickerProps {
  /** 当前时刻 HH:mm；空串表示尚未设置 */
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  /** 提供后，顶部会显示清除按钮 */
  onClear?: () => void;
}

/** 时间选择器：顶部当前值 + 时/分两列滚动 + 底部「现在 / 确定」，与系统级 time picker 一致。 */
export function TimePicker({ value, onChange, onDone, onClear }: TimePickerProps) {
  const { t } = useTranslation();
  const nowClock = clockOf(new Date());
  const [hour = "00", minute = "00"] = (value || nowClock).split(":");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 面板在小视口下会被限高并滚动：顶栏与底栏吸顶/吸底，当前值与确定按钮始终可达 */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b border-border/70 bg-bg-primary pb-1.5">
        <span className="flex-1 text-center text-base font-semibold tabular-nums text-text-primary">
          {value || "--:--"}
        </span>
        {onClear ? (
          <button
            type="button"
            aria-label={t("todo.timeClear")}
            disabled={!value}
            onClick={onClear}
            className="grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:pointer-events-none disabled:opacity-0 sm:h-6 sm:w-6"
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 divide-x divide-border/70">
        <TimeColumn label={t("todo.hour")} items={HOURS} value={hour} onSelect={(next) => onChange(`${next}:${minute}`)} />
        <TimeColumn label={t("todo.minute")} items={MINUTES} value={minute} onSelect={(next) => onChange(`${hour}:${next}`)} />
      </div>
      <div className="sticky bottom-0 z-10 mt-1 flex shrink-0 items-center gap-2 border-t border-border/70 bg-bg-primary px-1 pb-1 pt-2">
        <button
          type="button"
          onClick={() => onChange(nowClock)}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10 sm:px-1 sm:py-0 sm:text-[11px]"
        >
          {t("todo.timeNow")}
        </button>
        <div className="flex-1" />
        <button
          type="button"
          aria-label={t("common.confirm")}
          onClick={onDone}
          className="grid h-9 w-9 place-items-center rounded-full bg-accent text-white shadow-sm transition-all hover:brightness-95 active:scale-95 sm:h-7 sm:w-7"
        >
          <Check size={14} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

interface TimeColumnProps {
  label: string;
  items: string[];
  value: string;
  onSelect: (value: string) => void;
}

function TimeColumn({ label, items, value, onSelect }: TimeColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const index = items.indexOf(value);

  useEffect(() => {
    const list = listRef.current;
    if (!list || index < 0) return;
    list.scrollTop = index * ITEM_HEIGHT;
  }, [index]);

  return (
    <div className="relative min-w-0 flex-1">
      <div
        ref={listRef}
        role="listbox"
        aria-label={label}
        style={{ height: LIST_HEIGHT }}
        className="snap-y snap-proximity overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ height: LIST_PAD }} aria-hidden="true" />
        {items.map((item) => (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={item === value}
            onClick={() => onSelect(item)}
            style={{ height: ITEM_HEIGHT }}
            className={`block w-full snap-center text-center text-sm tabular-nums transition-colors ${
              item === value ? "bg-accent/10 font-semibold text-accent" : "text-text-secondary hover:bg-bg-tertiary"
            }`}
          >
            {item}
          </button>
        ))}
        <div style={{ height: LIST_PAD }} aria-hidden="true" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-bg-primary to-transparent" style={{ height: FADE_HEIGHT }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-primary to-transparent" style={{ height: FADE_HEIGHT }} aria-hidden="true" />
    </div>
  );
}

/** 本地时钟 HH:mm */
function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
