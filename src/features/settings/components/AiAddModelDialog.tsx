import { useId, useState, type FormEvent } from "react";
import { Modal } from "@/components/molecules/Modal";
import { Button } from "@/components/atoms/Button";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/i18n";
import { AiField, AiInput } from "./AiField";
import { useAiRemoteModels } from "../hooks/useAiRemoteModels";
import type { ProviderDraft } from "./aiSettingsTypes";

interface AiAddModelDialogProps {
  provider: ProviderDraft;
  existingModelIds: string[];
  presetModelId: string;
  onClose: () => void;
  onSubmit: (modelId: string, displayName: string) => void;
}

export function AiAddModelDialog({
  provider,
  existingModelIds,
  presetModelId,
  onClose,
  onSubmit,
}: AiAddModelDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open title={t("ai.addModel")} onClose={onClose}>
      <AiAddModelForm
        provider={provider}
        existingModelIds={existingModelIds}
        presetModelId={presetModelId}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

interface AiAddModelFormProps {
  provider: ProviderDraft;
  existingModelIds: string[];
  presetModelId: string;
  onClose: () => void;
  onSubmit: (modelId: string, displayName: string) => void;
}

function AiAddModelForm({
  provider,
  existingModelIds,
  presetModelId,
  onClose,
  onSubmit,
}: AiAddModelFormProps) {
  const { t } = useTranslation();
  const modelListId = useId();
  const remoteModels = useAiRemoteModels({ providerId: provider.id, baseUrl: provider.baseUrl, provider: provider.provider });
  const [modelId, setModelId] = useState(presetModelId);
  const [displayName, setDisplayName] = useState(presetModelId);
  const duplicate = existingModelIds.includes(modelId.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!modelId.trim() || duplicate) return;
    onSubmit(modelId.trim(), displayName.trim() || modelId.trim());
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <RemoteModelPicker
        remoteModels={remoteModels.remoteModels}
        fetchError={remoteModels.fetchError}
        isFetching={remoteModels.isFetching}
        onFetch={remoteModels.fetchModels}
      />
      <ModelIdField
        remoteModels={remoteModels.remoteModels}
        modelId={modelId}
        modelListId={modelListId}
        onInput={setModelId}
        onInputRemoteModel={setDisplayName}
      />
      <AiField label={t("ai.modelDisplayName")}><AiInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></AiField>
      <AiAddModelActions duplicate={duplicate} disabled={!modelId.trim()} onClose={onClose} />
    </form>
  );
}

function ModelIdField({ remoteModels, modelId, modelListId, onInput, onInputRemoteModel }: {
  remoteModels: string[];
  modelId: string;
  modelListId: string;
  onInput: (modelId: string) => void;
  onInputRemoteModel: (modelId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <AiField label={t("ai.model")}>
      <AiInput
        value={modelId}
        list={remoteModels.length > 0 ? modelListId : undefined}
        onChange={(event) => {
          const value = event.target.value;
          onInput(value);
          if (remoteModels.includes(value)) onInputRemoteModel(value);
        }}
        autoFocus
      />
      {remoteModels.length > 0 ? (
        <datalist id={modelListId}>
          {remoteModels.map((modelId) => (
            <option key={modelId} value={modelId} />
          ))}
        </datalist>
      ) : null}
    </AiField>
  );
}

function AiAddModelActions({ duplicate, disabled, onClose }: {
  duplicate: boolean;
  disabled: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {duplicate ? <p className="text-xs text-danger">{t("ai.modelAlreadyExists")}</p> : null}
      <div className="mt-1 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button type="submit" disabled={disabled || duplicate}>{t("ai.addModel")}</Button>
      </div>
    </>
  );
}

function RemoteModelPicker({ remoteModels, fetchError, isFetching, onFetch }: {
  remoteModels: string[];
  fetchError: string | null;
  isFetching: boolean;
  onFetch: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" aria-busy={isFetching}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-secondary">{t("ai.selectRemoteModel")}</span>
        <Button type="button" variant="ghost" className="inline-flex items-center gap-1 border border-border text-xs" onClick={onFetch} disabled={isFetching}>
          <RefreshCw size={13} className={isFetching ? "animate-spin" : undefined} />
          {isFetching ? t("ai.fetchingModels") : t("ai.fetchModels")}
        </Button>
      </div>
      {fetchError ? <p className="text-xs text-danger">{fetchError}</p> : null}
      {isFetching ? <RemoteModelSkeleton /> : null}
      {!isFetching && remoteModels.length === 0 ? (
        <p className="rounded-md bg-bg-secondary px-3 py-2 text-xs text-text-secondary">{t("ai.manualModelHint")}</p>
      ) : null}
    </div>
  );
}

function RemoteModelSkeleton() {
  return (
    <div className="flex flex-wrap gap-1">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <span key={item} className="h-6 w-20 animate-pulse rounded-full bg-bg-tertiary" />
      ))}
    </div>
  );
}
