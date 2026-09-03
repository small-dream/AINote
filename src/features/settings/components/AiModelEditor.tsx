import type { AiModelDto, AiSettings } from "@/api";
import { useTranslation } from "@/i18n";
import { useState } from "react";
import { AiAddModelDialog } from "./AiAddModelDialog";
import { AiModelToolbar } from "./AiModelToolbar";
import { AiModelList } from "./AiModelList";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiModelEditorProps {
  provider: ProviderDraft;
  models: AiModelDto[];
  defaultModelId: string | null;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onAddModel: (modelId: string, displayName: string) => void;
  onRemoveModel: (modelId: string) => void;
  onSetDefault: (modelId: string) => void;
}

export function AiModelEditor({
  provider,
  models,
  defaultModelId,
  onUpdate,
  onAddModel,
  onRemoveModel,
  onSetDefault,
}: AiModelEditorProps) {
  const { t } = useTranslation();
  const [addState, setAddState] = useState<{ preset: string } | null>(null);
  return (
    <section className="border-t border-border bg-bg-secondary/40 p-3">
      <AiModelToolbar count={models.length} onAdd={() => setAddState({ preset: "" })} />

      {models.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-secondary">
          {t("ai.modelsEmpty")}
        </p>
      ) : (
        <AiModelList models={models} defaultModelId={defaultModelId} onUpdate={onUpdate} onRemove={onRemoveModel} onSetDefault={onSetDefault} />
      )}
      {addState ? (
        <AiAddModelDialog
          key={addState.preset || "manual"}
          provider={provider}
          existingModelIds={models.map((model) => model.modelId)}
          presetModelId={addState.preset}
          onClose={() => setAddState(null)}
          onSubmit={(modelId, displayName) => {
            onAddModel(modelId, displayName);
            setAddState(null);
          }}
        />
      ) : null}
    </section>
  );
}
