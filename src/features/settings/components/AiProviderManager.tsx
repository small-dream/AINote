import type { AiProviderDto, AiSettings } from "@/api";
import { Plus } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { AiKeyDrafts } from "../hooks/useAiSettingsDraft";
import { AiProviderCard } from "./AiProviderCard";

interface AiProviderManagerProps {
  settings: AiSettings;
  providerKeys: AiProviderDto[];
  keyDrafts: AiKeyDrafts;
  onSetKey: (providerId: string, key: string) => void;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onAddProvider: () => void;
  onAddModel: (providerId: string, modelId: string, displayName: string) => void;
  onRemoveProvider: (providerId: string) => void;
  onRemoveModel: (modelId: string) => void;
}

/** Provider 卡片列表和新增入口 */
export function AiProviderManager({
  settings,
  providerKeys,
  keyDrafts,
  onSetKey,
  onUpdate,
  onAddProvider,
  onAddModel,
  onRemoveProvider,
  onRemoveModel,
}: AiProviderManagerProps) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      {settings.providers.map((provider) => (
        <AiProviderCard
          key={provider.id}
          provider={provider}
          hasKey={providerKeys.find((item) => item.id === provider.id)?.hasKey ?? false}
          keyDraft={keyDrafts[provider.id]}
          models={settings.models.filter((model) => model.providerId === provider.id)}
          defaultModelId={settings.defaultModelId}
          onSetKey={onSetKey}
          onUpdate={onUpdate}
          onAddModel={onAddModel}
          onRemove={onRemoveProvider}
          onRemoveModel={onRemoveModel}
        />
      ))}
      <button
        type="button"
        onClick={onAddProvider}
        className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-text-secondary transition-colors hover:border-accent hover:bg-accent-soft/50 hover:text-accent"
      >
        <Plus size={15} />
        {t("ai.addProvider")}
      </button>
    </section>
  );
}
