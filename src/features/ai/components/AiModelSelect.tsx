import { useEffect } from "react";
import { useTranslation } from "@/i18n";
import { useAiModelStore } from "@/stores/aiModel.store";
import { useAiConfig } from "../hooks/useAiConfig";
import { resolveModelSelection, usableAiModels } from "../utils/models";

interface AiModelSelectProps {
  className?: string;
}

/** 请求级模型选择器：默认模型由设置页维护，这里的选择是当前会话临时选择 */
export function AiModelSelect({ className = "" }: AiModelSelectProps) {
  const { t } = useTranslation();
  const { data } = useAiConfig();
  const options = usableAiModels(data);
  const selectedId = useAiModelStore((state) => state.selectedModelId);
  const setSelectedId = useAiModelStore((state) => state.setSelectedModelId);
  const resolvedId = resolveModelSelection(data, selectedId);

  useEffect(() => {
    if (resolvedId !== selectedId) setSelectedId(resolvedId);
  }, [resolvedId, selectedId, setSelectedId]);

  if (options.length === 0) {
    return <span className={`text-xs text-text-secondary ${className}`}>{t("ai.noModels")}</span>;
  }
  return (
    <select
      value={resolvedId ?? ""}
      onChange={(event) => setSelectedId(event.target.value)}
      aria-label={t("ai.modelSelector")}
      title={options.find((model) => model.id === resolvedId)?.label ?? t("ai.modelSelector")}
      className={`h-9 w-full min-w-0 rounded-md border border-border bg-bg-primary px-3 pr-8 text-sm text-text-primary transition-colors hover:border-text-tertiary focus:border-accent focus:outline-none ${className}`}
    >
      {options.map((model) => (
        <option key={model.id} value={model.id}>
          {model.label}
        </option>
      ))}
    </select>
  );
}
