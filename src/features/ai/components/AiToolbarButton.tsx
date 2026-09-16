import { IconButton } from "@/components/atoms/IconButton";
import { Wand2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAiConfig } from "../hooks/useAiConfig";
import { usableAiModels } from "../utils/models";
import { useUiStore } from "@/stores/ui.store";

interface AiToolbarButtonProps {
  onOpen: () => void;
  disabled?: boolean;
  /** 紧凑尺寸：与富文本格式工具栏的 32px 图标按钮对齐 */
  compact?: boolean;
  /** 禁用原因（如加密笔记不支持 AI）：作为 tooltip 文案，避免「灰掉但不说为什么」 */
  disabledReason?: string;
}

/** 工具栏 AI 触发按钮：已配置 → 打开写作菜单；未配置 → 引导去设置（P0-AI-1） */
export function AiToolbarButton({ onOpen, disabled, compact = false, disabledReason }: AiToolbarButtonProps) {
  const { t } = useTranslation();
  const { data } = useAiConfig();
  const configured = usableAiModels(data).length > 0;
  const resolved = resolveAiToolbar(configured, t, onOpen);
  const label = disabled && disabledReason ? disabledReason : resolved.label;
  return (
    <IconButton
      icon={Wand2}
      label={label}
      size={compact ? "sm" : "md"}
      tooltipPlacement="bottom"
      onClick={resolved.action}
      disabled={disabled}
    />
  );
}

function resolveAiToolbar(configured: boolean, t: ReturnType<typeof useTranslation>["t"], onOpen: () => void) {
  return {
    label: configured ? t("ai.title") : t("ai.notConfigured"),
    action: configured ? onOpen : () => useUiStore.getState().openSettings("ai"),
  };
}
