import type { ReactNode } from "react";

/** 全局提示卡壳：Toast、待办提醒等浮层共用的实底卡片。
 *  实底（不透明）+ 细边框 + 阴影，叠在笔记内容上也保持文字清晰可读；
 *  语义色只落在图标与局部点缀上，不整卡染色。 */
export const ALERT_CARD_CLASS = "pointer-events-auto w-full max-w-md rounded-lg border border-border bg-bg-primary shadow-lg";

interface AlertCardProps {
  children: ReactNode;
  /** error 语义用 "alert"，其余提示用 "status"（由调用方决定）。 */
  role?: "alert" | "status";
  /** 无障碍标签：浮层卡片的用途名。 */
  label?: string;
  /** 卡内布局补白等附加类。 */
  className?: string;
}

export function AlertCard({ children, role, label, className = "" }: AlertCardProps) {
  return (
    <section role={role} aria-label={label} className={`${ALERT_CARD_CLASS} ${className}`.trim()}>
      {children}
    </section>
  );
}
