import { Button } from "@/components/atoms/Button";
import { Sparkles } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAiConfig } from "../hooks/useAiConfig";
import { useUiStore } from "@/stores/ui.store";

interface AiToolbarButtonProps {
  onOpen: () => void;
  disabled?: boolean;
}

/** 工具栏 AI 触发按钮：已配置 → 打开写作菜单；未配置 → 引导去设置（P0-AI-1） */
export function AiToolbarButton({ onOpen, disabled }: AiToolbarButtonProps) {
  const { t } = useTranslation();
  const { data } = useAiConfig();
  const configured = Boolean(data?.enabled && (data.provider === "ollama" || data.hasKey));
  return (
    <Button
      variant="ghost"
      aria-label={configured ? t("ai.title") : t("ai.notConfigured")}
      title={configured ? t("ai.title") : t("ai.notConfigured")}
      className="inline-flex items-center gap-1.5 border border-transparent px-2.5 text-xs hover:border-border"
      onClick={configured ? onOpen : () => useUiStore.getState().openSettings()}
      disabled={disabled}
    >
      <Sparkles size={14} />
      <span className="hidden xl:inline">{configured ? t("ai.title") : t("ai.openSettings")}</span>
    </Button>
  );
}
