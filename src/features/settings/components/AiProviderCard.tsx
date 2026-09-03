import type { AiModelDto, AiSettings } from "@/api";
import { AiProviderCatalog } from "./AiProviderCatalog";
import { AiProviderHeader } from "./AiProviderHeader";
import { AiProviderFields } from "./AiProviderFields";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiProviderCardProps {
  provider: ProviderDraft;
  hasKey: boolean;
  keyDraft: string | undefined;
  models: AiModelDto[];
  defaultModelId: string | null;
  onSetKey: (providerId: string, key: string) => void;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onAddModel: (providerId: string, modelId: string, displayName: string) => void;
  onRemove: (providerId: string) => void;
  onRemoveModel: (modelId: string) => void;
}

export function AiProviderCard({
  provider,
  hasKey,
  keyDraft,
  models,
  defaultModelId,
  onSetKey,
  onUpdate,
  onAddModel,
  onRemove,
  onRemoveModel,
}: AiProviderCardProps) {
  const patchProvider = (part: Partial<ProviderDraft>) =>
    onUpdate((current) => ({
      ...current,
      providers: current.providers.map((item: ProviderDraft) => (item.id === provider.id ? { ...item, ...part } : item)),
    }));
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-bg-primary shadow-sm">
      <AiProviderHeader
        provider={provider}
        onToggle={(enabled) => patchProvider({ enabled })}
        onRemove={() => onRemove(provider.id)}
      />
      <AiProviderFields provider={provider} hasKey={hasKey} keyDraft={keyDraft} onSetKey={onSetKey} onChange={patchProvider} />
      <AiProviderCatalog
        provider={provider}
        models={models}
        defaultModelId={defaultModelId}
        onUpdate={onUpdate}
        onAddModel={(modelId, displayName) => onAddModel(provider.id, modelId, displayName)}
        onRemoveModel={onRemoveModel}
      />
    </article>
  );
}
