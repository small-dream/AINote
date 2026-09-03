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

  useEffect(() => {
    const resolved = resolveModelSelection(data, selectedId);
    if (resolved !== selectedId) setSelectedId(resolved);
  }, [data, selectedId, setSelectedId]);

  if (options.length === 0) {
    return <span className={`text-xs text-text-secondary ${className}`}>{t("ai.noModels")}</span>;
  }
  return (
    <select
      value={selectedId ?? ""}
      onChange={(event) => setSelectedId(event.target.value)}
      aria-label={t("ai.modelSelector")}
      className={`max-w-48 rounded-md border border-border bg-bg-primary px-1.5 py-1 text-xs focus:border-accent focus:outline-none ${className}`}
    >
      {options.map((model) => (
        <option key={model.id} value={model.id}>
          {model.label}
        </option>
      ))}
    </select>
  );
}
