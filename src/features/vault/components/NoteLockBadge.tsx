import { Lock } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";

interface NoteLockBadgeProps {
  /** 激活（当前打开）态配色 */
  active?: boolean;
}

/** 加密笔记徽标：笔记列表 / 目录树中的小锁图标，悬浮提示「已加密」。 */
export function NoteLockBadge({ active = false }: NoteLockBadgeProps) {
  const { t } = useTranslation();
  return (
    <Tooltip content={t("vault.encryptedBadge")}>
      <Lock
        size={12}
        strokeWidth={2}
        role="img"
        aria-label={t("vault.encryptedBadge")}
        className={`shrink-0 ${active ? "text-accent" : "text-text-tertiary"}`}
      />
    </Tooltip>
  );
}
