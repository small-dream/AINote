import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";

/** 移动端顶栏图标按钮：固定 44px 触达尺寸 + Tooltip 提示。 */
export function MobileIconButton({ icon: Icon, label, onClick, disabled = false, spinning = false }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean; spinning?: boolean }) {
  return (
    <Tooltip content={label}>
      <button type="button" className="mobile-icon-button" aria-label={label} onClick={onClick} disabled={disabled}>
        <Icon size={20} className={spinning ? "animate-spin" : ""} />
      </button>
    </Tooltip>
  );
}

/** 移动端底部导航项：图标 + 文案，当前项高亮。 */
export function MobileNavButton({ active = false, label, icon: Icon, onClick }: { active?: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-current={active ? "page" : undefined} onClick={onClick} className={`mobile-nav-button ${active ? "is-active" : ""}`}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}
