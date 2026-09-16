import { Calendar, Clock, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { buildDueAt, dueDateLabel, dueDay, dueDayOffset, dueTime } from "../utils/task";

/* 移动端 chip 外观与 ChipShell 的 Chip 同尺寸（36px 触控目标），差异只在于触发层：
   覆盖式原生 input 铺满 chip，点哪儿都由系统弹出选择器，不经过 portal 浮层。 */
const CHIP_CLASS = "relative flex h-9 max-w-40 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors";
const INPUT_CLASS = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed";
const CLEAR_CLASS = "relative z-20 -mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:text-text-primary";

interface NativeChipShellProps {
  kind: "date" | "time";
  icon: LucideIcon;
  /** 展示文案（日期 chip 显示 今天 / 明天 / MM-DD，时间 chip 显示 HH:mm） */
  label: string;
  ariaLabel: string;
  active: boolean;
  disabled?: boolean;
  toneClass?: string | undefined;
  /** 原生 input 的当前值：date 为 `YYYY-MM-DD`、time 为 `HH:mm`，空串表示未设置 */
  value: string;
  onChange: (value: string) => void;
  onClear?: (() => void) | undefined;
  clearLabel?: string | undefined;
}

/** 原生控件 chip：视觉层只负责展示，真正的交互层是铺满 chip 的透明 input。
    不用 Tooltip——触屏点按时它会被 focus-within 触发并跟着弹出来。 */
function NativeChipShell({ kind, icon: Icon, label, ariaLabel, active, disabled = false, toneClass, value, onChange, onClear, clearLabel }: NativeChipShellProps) {
  const tone = active ? `bg-bg-tertiary ${toneClass ?? "text-text-primary"}` : "text-text-tertiary";
  return (
    <span className={`${CHIP_CLASS} ${tone} ${disabled ? "opacity-40" : ""}`}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" className="pointer-events-none shrink-0" />
      <span className="pointer-events-none truncate" aria-hidden="true">{label}</span>
      <input
        type={kind}
        value={value}
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
      {onClear ? (
        <button type="button" aria-label={clearLabel} onClick={onClear} className={CLEAR_CLASS}>
          <X size={12} strokeWidth={2.4} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

interface NativeDueDateChipProps {
  /** 当前截止时间：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * 移动端截止日期 chip：点击即弹出系统日期选择器。
 * 已有具体时刻时保留时刻（系统只改日期）；系统的「清除」与 chip 上的 × 都表示清空截止时间。
 */
export function NativeDueDateChip({ value, onChange }: NativeDueDateChipProps) {
  const { t } = useTranslation();
  const time = value ? dueTime(value) : "";
  const now = new Date();
  const offset = value ? dueDayOffset(value, now) : null;
  const toneClass = offset !== null && offset < 0 ? "text-danger" : offset === 0 ? "text-accent" : undefined;

  return (
    <NativeChipShell
      kind="date"
      icon={Calendar}
      label={value ? dueDateLabel(value, t("todo.dateToday"), t("todo.dateTomorrow"), now) : t("todo.dueDate")}
      ariaLabel={t("todo.setDueDate")}
      active={value !== null}
      toneClass={toneClass}
      value={value ? dueDay(value) : ""}
      onChange={(next) => onChange(next ? buildDueAt(next, time) : null)}
      onClear={value !== null ? () => onChange(null) : undefined}
      clearLabel={t("todo.dateClear")}
    />
  );
}

interface NativeDueTimeChipProps {
  /** 当前截止时间；null 表示还没选日期 */
  dueAt: string | null;
  onChange: (value: string | null) => void;
}

/**
 * 移动端时间 chip：在已选日期上追加一天中的具体时刻，点击弹出系统时间选择器。
 * 系统的「清除」或 chip 上的 × 都回到「只到天」（当天结束前）。
 */
export function NativeDueTimeChip({ dueAt, onChange }: NativeDueTimeChipProps) {
  const { t } = useTranslation();
  const time = dueAt ? dueTime(dueAt) : "";
  const disabled = dueAt === null;

  return (
    <NativeChipShell
      kind="time"
      icon={Clock}
      label={time || t("todo.dueTime")}
      ariaLabel={t("todo.setDueTime")}
      active={time !== ""}
      disabled={disabled}
      value={time}
      onChange={(next) => onChange(buildDueAt(dueDay(dueAt ?? ""), next))}
      onClear={time ? () => onChange(dueDay(dueAt ?? "")) : undefined}
      clearLabel={t("todo.timeClear")}
    />
  );
}
