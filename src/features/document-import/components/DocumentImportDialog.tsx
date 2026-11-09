import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { DocumentImportController } from "../hooks/useDocumentImport";
import type { DocumentImportErrorCode } from "../types";
import { DocumentImportPreview } from "./DocumentImportPreview";

const ERROR_KEYS: Record<DocumentImportErrorCode, TranslationKey> = {
  desktopOnly: "importDoc.errorDesktopOnly",
  unsupported: "importDoc.errorUnsupported",
  tooLarge: "importDoc.errorTooLarge",
  empty: "importDoc.errorEmpty",
  passwordProtected: "importDoc.errorPassword",
  parseFailed: "importDoc.errorParse",
  saveFailed: "importDoc.errorSave",
};

function Progress({ state }: { state: DocumentImportController["state"] }) {
  const { t } = useTranslation();
  const { current, total } = state.progress;
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="space-y-2">
      <p className="text-sm text-text-primary">{total > 1 ? t("importDoc.pageProgress", { current, total }) : t("importDoc.converting")}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg-secondary" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ErrorMessage({ state }: { state: DocumentImportController["state"] }) {
  const { t } = useTranslation();
  if (!state.error) return null;
  return (
    <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
      <p>{t(ERROR_KEYS[state.error])}</p>
      {state.error === "saveFailed" && state.errorDetail ? <p className="mt-1 text-xs opacity-80">{state.errorDetail}</p> : null}
    </div>
  );
}

export function DocumentImportDialog({ controller }: { controller: DocumentImportController }) {
  const { t } = useTranslation();
  const { state, cancel, confirm, retry } = controller;
  const converting = state.phase === "converting";
  const saving = state.phase === "saving";
  const ready = state.phase === "ready";
  const failed = state.phase === "error";
  return (
    <Modal open={state.open} title={t("importDoc.title")} onClose={() => { if (!saving) cancel(); }} className="max-w-3xl!">
      <div className="space-y-3">
        <p className="truncate text-xs text-text-tertiary">{state.fileName}</p>
        {converting ? <Progress state={state} /> : null}
        {failed ? <ErrorMessage state={state} /> : null}
        {state.result ? <DocumentImportPreview result={state.result} /> : null}
        {ready ? <p className="text-xs text-text-tertiary">{t("importDoc.previewHint")}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancel} disabled={saving}>
            {t("common.cancel")}
          </Button>
          {failed ? (
            <Button type="button" variant="primary" onClick={() => void (state.error === "saveFailed" ? confirm() : retry())} disabled={saving}>
              {t("common.retry")}
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={() => void confirm()} disabled={!ready || saving}>
              {saving ? t("importDoc.saving") : t("importDoc.confirm")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
