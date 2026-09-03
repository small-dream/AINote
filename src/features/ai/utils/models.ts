import type { AiSettingsDto } from "@/api";

export interface AiModelOption {
  id: string;
  label: string;
  isLocal: boolean;
}

/** 只返回 Provider 与模型同时启用、且云端 Provider 已配置 Key 的选项。 */
export function usableAiModels(settings: AiSettingsDto | undefined): AiModelOption[] {
  if (!settings?.enabled) return [];
  const providerById = new Map(settings.providers.map((provider) => [provider.id, provider]));
  return settings.models.flatMap((model) => {
    const provider = providerById.get(model.providerId);
    if (!model.enabled || !provider?.enabled) return [];
    if (provider.provider !== "ollama" && !provider.hasKey) return [];
    return [{ id: model.id, label: `${provider.displayName} / ${model.displayName}`, isLocal: provider.provider === "ollama" }];
  });
}

/** 找到默认模型；默认不可用时返回第一个可用模型，避免入口完全锁死。 */
export function resolveModelSelection(
  settings: AiSettingsDto | undefined,
  selectedId: string | null,
): string | null {
  const models = usableAiModels(settings);
  if (models.some((model) => model.id === selectedId)) return selectedId;
  if (models.some((model) => model.id === settings?.defaultModelId)) return settings?.defaultModelId ?? null;
  return models[0]?.id ?? null;
}
