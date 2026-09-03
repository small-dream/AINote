import { Plug, Trash2 } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { useTranslation } from "@/i18n";
import { AiToggle } from "./AiField";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiProviderHeaderProps {
  provider: ProviderDraft;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

export function AiProviderHeader({ provider, onToggle, onRemove }: AiProviderHeaderProps) {
  const { t } = useTranslation();
  const typeLabel = provider.provider === "openAiCompatible" ? t("ai.providerOpenAi") : t("ai.providerOllama");
  return (
    <header className="flex items-start gap-3 border-b border-border bg-bg-secondary/70 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
        <Plug size={17} strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text-primary">
          {provider.displayName || t("ai.unnamedProvider")}
        </p>
        <p className="mt-0.5 truncate text-xs text-text-secondary">
          {typeLabel} · {provider.baseUrl || t("ai.baseUrlMissing")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            provider.enabled ? "bg-accent-soft text-accent" : "bg-bg-tertiary text-text-secondary"
          }`}
        >
          {provider.enabled ? t("ai.enabled") : t("ai.disabled")}
        </span>
        <AiToggle checked={provider.enabled} label={t("ai.enableProvider")} onChange={onToggle} />
        <IconButton
          icon={Trash2}
          label={t("ai.removeProvider")}
          size="sm"
          className="text-text-secondary hover:text-danger"
          onClick={onRemove}
        />
      </div>
    </header>
  );
}
