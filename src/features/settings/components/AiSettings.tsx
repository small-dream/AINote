import { Button } from "@/components/atoms/Button";
import { useAiConfig } from "@/features/ai/hooks/useAiConfig";
import { useTranslation } from "@/i18n";
import { AiToggle } from "./AiField";
import { AiProviderManager } from "./AiProviderManager";
import { useAiSettingsDraft } from "../hooks/useAiSettingsDraft";

/** 设置页 AI 内容区：全局能力状态 + Provider 连接 + 模型目录。 */
export function AiSettings() {
  const { t } = useTranslation();
  const { data, isLoading } = useAiConfig();

  if (isLoading || !data) return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  return <AiSettingsEditor config={data} />;
}

function AiSettingsEditor({ config }: { config: NonNullable<ReturnType<typeof useAiConfig>["data"]> }) {
  const draft = useAiSettingsDraft(config);
  return (
    <form onSubmit={draft.submit} className="flex flex-col gap-3">
      <AiSummaryCard settings={draft.settings} onToggle={(enabled) => draft.update((current) => ({ ...current, enabled }))} />
      <AiProviderManager
        settings={draft.settings}
        providerKeys={config.providers}
        keyDrafts={draft.keyDrafts}
        onSetKey={draft.setKeyDraft}
        onUpdate={draft.update}
        onAddProvider={draft.addProvider}
        onAddModel={draft.addModel}
        onRemoveProvider={draft.removeProvider}
        onRemoveModel={draft.removeModel}
      />
      <FormFooter saving={draft.saving} error={draft.error} />
    </form>
  );
}

interface AiSummarySettings {
  enabled: boolean;
  providers: { id: string }[];
  models: { id: string; displayName: string }[];
  defaultModelId: string | null;
}

function AiSummaryCard({ settings, onToggle }: { settings: AiSummarySettings; onToggle: (enabled: boolean) => void }) {
  const { t } = useTranslation();
  const defaultModel = settings.models.find((model) => model.id === settings.defaultModelId);
  const summary = t("ai.summary", {
    providers: settings.providers.length,
    models: settings.models.length,
    model: defaultModel?.displayName || t("ai.defaultModelEmpty"),
  });
  return (
    <section className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg-secondary/60 p-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-text-primary">{t("ai.capability")}</h3>
        <p className="mt-0.5 truncate text-xs text-text-secondary">{summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs ${settings.enabled ? "bg-accent-soft text-accent" : "bg-bg-tertiary text-text-secondary"}`}>
          {settings.enabled ? t("ai.enabled") : t("ai.disabled")}
        </span>
        <AiToggle checked={settings.enabled} label={t("ai.enable")} onChange={onToggle} />
      </div>
    </section>
  );
}

function FormFooter({ saving, error }: { saving: boolean; error: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 bg-bg-primary/92 px-1 py-2 backdrop-blur">
      {error ? <p className="min-w-0 truncate text-xs text-danger">{error}</p> : <span />}
      <Button type="submit" className="shrink-0 px-4" disabled={saving}>{saving ? t("common.saving") : t("ai.save")}</Button>
    </div>
  );
}
