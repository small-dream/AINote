/** 角标配色：有逾期用危险色，否则用警示色（今天到期） */
export type NavBadgeTone = "danger" | "warning";

const TONE_CLASS: Record<NavBadgeTone, string> = {
  danger: "bg-danger text-bg-primary",
  warning: "bg-warning text-bg-primary",
};

/**
 * 导航入口的数量角标：0 不渲染，超过 99 收敛成 `99+`。
 * 纯展示——不抢点击（`pointer-events-none`），也不参与无障碍名字（`aria-hidden`，
 * 数量由调用方并进入口的 `aria-label`）。
 */
export function NavCountBadge({ count, tone }: { count: number; tone: NavBadgeTone }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-nav-count-badge=""
      className={`pointer-events-none absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-medium leading-4 ${TONE_CLASS[tone]}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
