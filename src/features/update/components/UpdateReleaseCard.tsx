import { FileText } from "lucide-react";
import type { UpdateInfo } from "@/api/update.api";
import { useTranslation } from "@/i18n";
import { formatUpdateDate } from "../utils/updateFormat";

interface UpdateReleaseCardProps {
  info: UpdateInfo;
}

export function UpdateReleaseCard({ info }: UpdateReleaseCardProps) {
  const { t } = useTranslation();
  const releasedAt = formatUpdateDate(info.date);

  return (
    <section className="rounded-lg border border-border bg-bg-primary">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileText size={16} className="text-text-secondary" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-text-primary">{t("update.releaseNotes")}</h3>
        {releasedAt && <span className="ml-auto text-xs text-text-secondary">{releasedAt}</span>}
      </header>
      <div className="px-4 py-3">
        {info.body ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-text-secondary">{info.body}</p>
        ) : (
          <p className="text-sm text-text-secondary">{t("update.noNotes")}</p>
        )}
      </div>
    </section>
  );
}
