import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { DocumentImportResult, DocumentImportWarning } from "../types";

const PREVIEW_LIMIT = 4000;

const WARNING_KEYS: Record<DocumentImportWarning, TranslationKey> = {
  formatSimplified: "importDoc.warningFormat",
  scannedPdf: "importDoc.warningScanned",
  imageLimit: "importDoc.warningImageLimit",
};

export function DocumentImportPreview({ result }: { result: DocumentImportResult }) {
  const { t } = useTranslation();
  const preview = result.markdown.slice(0, PREVIEW_LIMIT);
  const truncated = result.markdown.length > PREVIEW_LIMIT;
  const pages = result.pages ? t("importDoc.summaryPages", { count: result.pages }) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
        <span className="rounded-full bg-bg-secondary px-2 py-1">{t("importDoc.summary", { count: result.characters })}</span>
        {result.assets.length > 0 ? <span className="rounded-full bg-bg-secondary px-2 py-1">{t("importDoc.summaryImages", { count: result.assets.length })}</span> : null}
        {pages ? <span className="rounded-full bg-bg-secondary px-2 py-1">{pages}</span> : null}
      </div>
      {result.warnings.length > 0 ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <p className="mb-1 font-medium">{t("importDoc.warningTitle")}</p>
          <ul className="list-disc space-y-1 pl-4">{result.warnings.map((warning) => <li key={warning}>{t(WARNING_KEYS[warning])}</li>)}</ul>
        </div>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-medium text-text-secondary">{t("importDoc.preview")}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-bg-secondary p-3 text-xs leading-5 text-text-primary">{preview}</pre>
        {truncated ? <p className="mt-1 text-xs text-text-tertiary">{t("importDoc.previewTruncated", { count: PREVIEW_LIMIT })}</p> : null}
      </div>
    </div>
  );
}
