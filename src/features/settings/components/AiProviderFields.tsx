import type { AiProvider } from "@/api";
import { useTranslation } from "@/i18n";
import { AiField, AiInput, AiSelect } from "./AiField";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiProviderFieldsProps {
  provider: ProviderDraft;
  hasKey: boolean;
  keyDraft: string | undefined;
  onSetKey: (providerId: string, key: string) => void;
  onChange: (part: Partial<ProviderDraft>) => void;
}

export function AiProviderFields({ provider, hasKey, keyDraft, onSetKey, onChange }: AiProviderFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2">
      <AiField label={t("ai.providerName")}>
        <AiInput value={provider.displayName} onChange={(event) => onChange({ displayName: event.target.value })} />
      </AiField>
      <AiField label={t("ai.provider")}>
        <AiSelect value={provider.provider} onChange={(event) => onChange({ provider: event.target.value as AiProvider })}>
          <option value="openAiCompatible">{t("ai.providerOpenAi")}</option>
          <option value="ollama">{t("ai.providerOllama")}</option>
        </AiSelect>
      </AiField>
      <AiField label={t("ai.baseUrl")}>
        <AiInput value={provider.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} />
      </AiField>
      <AiField label={t("ai.apiKey")}>
        <AiInput
          type="password"
          value={keyDraft ?? ""}
          placeholder={hasKey ? t("ai.apiKeySavedPlaceholder") : t("ai.apiKeyPlaceholderEmpty")}
          onChange={(event) => onSetKey(provider.id, event.target.value)}
        />
      </AiField>
    </div>
  );
}
