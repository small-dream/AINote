import type { AiModelDto, AiSettings } from "@/api";
import { AiModelEditor } from "./AiModelEditor";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiProviderCatalogProps {
  provider: ProviderDraft;
  models: AiModelDto[];
  defaultModelId: string | null;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onAddModel: (modelId: string, displayName: string) => void;
  onRemoveModel: (modelId: string) => void;
}

export function AiProviderCatalog({
  provider,
  models,
  defaultModelId,
  onUpdate,
  onAddModel,
  onRemoveModel,
}: AiProviderCatalogProps) {
  return (
    <AiModelEditor
      provider={provider}
      models={models}
      defaultModelId={defaultModelId}
      onUpdate={onUpdate}
      onAddModel={onAddModel}
      onRemoveModel={onRemoveModel}
      onSetDefault={(modelId) => onUpdate((current: AiSettings) => ({ ...current, defaultModelId: modelId }))}
    />
  );
}
