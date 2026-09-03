import { useCallback, useState, type FormEvent } from "react";
import { messageOf } from "@/api";
import type { AiSettings, AiSettingsDto } from "@/api";
import { useSaveAiConfig } from "@/features/ai/hooks/useAiConfig";

export type AiKeyDrafts = Record<string, string>;
type Update = (updater: (current: AiSettings) => AiSettings) => void;

function draftFromConfig(config: AiSettingsDto): AiSettings {
  return {
    schemaVersion: 2,
    enabled: config.enabled,
    providers: config.providers.map((provider) => ({
      id: provider.id,
      provider: provider.provider,
      displayName: provider.displayName,
      baseUrl: provider.baseUrl,
      enabled: provider.enabled,
    })),
    models: config.models.map((model) => ({ ...model })),
    defaultModelId: config.defaultModelId,
  };
}

function newAiId(prefix: string): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

/** 设置页 AI 草稿状态：从 Query 数据初始化，保存前保留本地编辑。 */
export function useAiSettingsDraft(config: AiSettingsDto) {
  const [settings, setSettings] = useState(() => draftFromConfig(config));
  const [keyDrafts, setKeyDrafts] = useState<AiKeyDrafts>({});
  const update = useCallback<Update>((updater) => setSettings(updater), []);
  const { addProvider, addModel, removeModel, removeProvider } = useModelActions(update, setKeyDrafts);
  const setKeyDraft = useCallback(
    (providerId: string, key: string) => setKeyDrafts((current) => ({ ...current, [providerId]: key })),
    [],
  );
  const { submit, saving, error } = useSaveDraft(settings, keyDrafts, setKeyDrafts);
  return { settings, keyDrafts, update, addProvider, addModel, removeModel, removeProvider, setKeyDraft, submit, saving, error };
}

function useModelActions(update: Update, setKeyDrafts: React.Dispatch<React.SetStateAction<AiKeyDrafts>>) {
  const addProvider = useCallback(() => update((current) => ({
    ...current,
    providers: [...current.providers, { id: newAiId("provider"), provider: "openAiCompatible", displayName: "", baseUrl: "", enabled: false }],
  })), [update]);
  const addModel = useCallback((providerId: string, modelId: string, displayName: string) => update((current) => ({
    ...current,
    models: [...current.models, { id: newAiId("model"), providerId, modelId, displayName, enabled: true }],
  })), [update]);
  const removeModel = useCallback((modelId: string) => update((current) => ({
    ...current,
    models: current.models.filter((model) => model.id !== modelId),
    defaultModelId: current.defaultModelId === modelId ? null : current.defaultModelId,
  })), [update]);
  const removeProvider = useCallback((providerId: string) => {
    setKeyDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== providerId)));
    update((current) => {
      const modelIds = new Set(current.models.filter((model) => model.providerId === providerId).map((model) => model.id));
      return {
        ...current,
        providers: current.providers.filter((provider) => provider.id !== providerId),
        models: current.models.filter((model) => !modelIds.has(model.id)),
        defaultModelId: current.defaultModelId && modelIds.has(current.defaultModelId) ? null : current.defaultModelId,
      };
    });
  }, [setKeyDrafts, update]);
  return { addProvider, addModel, removeModel, removeProvider };
}

function useSaveDraft(settings: AiSettings, keyDrafts: AiKeyDrafts, setKeyDrafts: React.Dispatch<React.SetStateAction<AiKeyDrafts>>) {
  const save = useSaveAiConfig();
  const submit = useCallback((event: FormEvent) => {
    event.preventDefault();
    const apiKeys = Object.entries(keyDrafts).map(([providerId, key]) => ({ providerId, key }));
    save.mutate({ settings, apiKeys }, { onSuccess: () => setKeyDrafts({}) });
  }, [keyDrafts, save, setKeyDrafts, settings]);
  return { submit, saving: save.isPending, error: save.isError ? `保存失败：${messageOf(save.error)}` : null };
}
