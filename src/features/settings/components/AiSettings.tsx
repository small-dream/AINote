import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/atoms/Button";
import { messageOf } from "@/api";
import { useAiConfig, useSaveAiConfig } from "@/features/ai/hooks/useAiConfig";
import type { AiConfigDto } from "@/api";
import { useTranslation } from "@/i18n";

interface AiFormState {
  enabled: boolean;
  provider: AiConfigDto["provider"];
  baseUrl: string;
  model: string;
  apiKey: string;
}

const INPUT_CLASS = "w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm focus:border-accent focus:outline-none";

/** 设置页 AI 内容区：Provider / 模型 / API Key（标题由设置视图统一提供）。 */
export function AiSettings() {
  const { t } = useTranslation();
  const { data, isLoading } = useAiConfig();
  if (isLoading || !data) return <p className="text-sm text-text-secondary">{t("common.loading")}</p>;
  return <AiSettingsForm initial={data} />;
}

function AiSettingsForm({ initial }: { initial: AiConfigDto }) {
  const { t } = useTranslation();
  const save = useSaveAiConfig();
  const [form, setForm] = useState<AiFormState>({ enabled: initial.enabled, provider: initial.provider, baseUrl: initial.baseUrl, model: initial.model, apiKey: "" });
  const cfg = { enabled: form.enabled, provider: form.provider, baseUrl: form.baseUrl, model: form.model };
  const patch = (part: Partial<AiFormState>) => setForm((f) => ({ ...f, ...part }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const apiKey = form.apiKey.trim() ? form.apiKey.trim() : null;
    save.mutate({ cfg, apiKey });
    if (apiKey) patch({ apiKey: "" });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <EnableField checked={form.enabled} onChange={(v) => patch({ enabled: v })} />
      <Field label={t("ai.provider")}>
        <select value={form.provider} onChange={(e) => patch({ provider: e.target.value as AiConfigDto["provider"] })} className={INPUT_CLASS}>
          <option value="openAiCompatible">{t("ai.providerOpenAi")}</option>
          <option value="ollama">{t("ai.providerOllama")}</option>
        </select>
      </Field>
      <Field label={t("ai.baseUrl")}>
        <input value={form.baseUrl} onChange={(e) => patch({ baseUrl: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label={t("ai.model")}>
        <input value={form.model} onChange={(e) => patch({ model: e.target.value })} className={INPUT_CLASS} />
      </Field>
      <Field label={t("ai.apiKey")}>
        <AiKeyField hasKey={initial.hasKey} value={form.apiKey} onChange={(v) => patch({ apiKey: v })} onClear={() => save.mutate({ cfg, apiKey: "" })} />
      </Field>
      <FormActions isPending={save.isPending} isError={save.isError} message={save.isError ? t("ai.saveFailed", { message: messageOf(save.error) }) : null} />
    </form>
  );
}

function EnableField({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {t("ai.enable")}
    </label>
  );
}

function AiKeyField({ hasKey, value, onChange, onClear }: { hasKey: boolean; value: string; onChange: (v: string) => void; onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input type="password" value={value} placeholder={hasKey ? t("ai.apiKeyPlaceholder") : ""} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} />
        {hasKey ? <Button type="button" variant="ghost" className="shrink-0" onClick={onClear}>{t("ai.clearKey")}</Button> : null}
      </div>
      {hasKey ? <p className="text-xs text-text-tertiary">{t("ai.hasKey")}</p> : null}
    </div>
  );
}

function FormActions({ isPending, isError, message }: { isPending: boolean; isError: boolean; message: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      {isError ? <p className="text-xs text-danger">{message}</p> : <span />}
      <Button type="submit" disabled={isPending}>{isPending ? t("common.saving") : t("ai.save")}</Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}
