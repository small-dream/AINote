import { Star, Trash2 } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import type { AiModelDto, AiSettings } from "@/api";
import { useTranslation } from "@/i18n";
import { AiToggle } from "./AiField";

interface AiModelListProps {
  models: AiModelDto[];
  defaultModelId: string | null;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onRemove: (modelId: string) => void;
  onSetDefault: (modelId: string) => void;
}

export function AiModelList({ models, defaultModelId, onUpdate, onRemove, onSetDefault }: AiModelListProps) {
  return (
    <ul className="mt-3 space-y-2">
      {models.map((model) => (
        <AiModelRow
          key={model.id}
          model={model}
          isDefault={defaultModelId === model.id}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSetDefault={onSetDefault}
        />
      ))}
    </ul>
  );
}

function AiModelRow({ model, isDefault, onUpdate, onRemove, onSetDefault }: {
  model: AiModelDto;
  isDefault: boolean;
  onUpdate: (updater: (current: AiSettings) => AiSettings) => void;
  onRemove: (modelId: string) => void;
  onSetDefault: (modelId: string) => void;
}) {
  const { t } = useTranslation();
  const patch = (part: Partial<AiModelDto>) => onUpdate((current) => ({ ...current, models: current.models.map((item) => (item.id === model.id ? { ...item, ...part } : item)) }));
  return (
    <li className="flex h-11 items-center gap-2 rounded-lg border border-border bg-bg-primary px-2">
      <AiToggle checked={model.enabled} label={t("ai.enableModel")} onChange={(checked) => patch({ enabled: checked })} />
      <input
        value={model.displayName}
        placeholder={model.modelId}
        aria-label={t("ai.modelDisplayName")}
        onChange={(event) => patch({ displayName: event.target.value })}
        className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors hover:bg-bg-secondary focus:border-accent focus:bg-bg-primary focus:outline-none"
      />
      <span className="hidden max-w-40 truncate text-xs text-text-tertiary sm:block" title={model.modelId}>{model.modelId}</span>
      <IconButton
        icon={Star}
        label={isDefault ? t("ai.isDefault") : t("ai.setDefault")}
        size="sm"
        active={isDefault}
        onClick={() => onSetDefault(model.id)}
      />
      <IconButton
        icon={Trash2}
        label={t("ai.removeModel")}
        size="sm"
        className="text-text-secondary hover:text-danger"
        onClick={() => onRemove(model.id)}
      />
    </li>
  );
}
