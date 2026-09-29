import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { useAiConfig } from "./useAiConfig";
import { usableAiModels } from "../utils/models";

export interface AiToolbarAction {
  /** 已配置时为 ai.title；未配置时为引导文案（ai.notConfigured），菜单项应将其用作 hint 而非 label */
  label: string;
  configured: boolean;
  action: () => void;
}

/** AI 入口动作：已配置 → 打开写作菜单；未配置 → 引导去设置（P0-AI-1；工具栏按钮与溢出菜单项共用） */
export function useAiToolbarAction(onOpen: () => void): AiToolbarAction {
  const { t } = useTranslation();
  const { data } = useAiConfig();
  const configured = usableAiModels(data).length > 0;
  return {
    label: configured ? t("ai.title") : t("ai.notConfigured"),
    configured,
    action: configured ? onOpen : () => useUiStore.getState().openSettings("ai"),
  };
}
