import { FileText } from "lucide-react";
import type { UpdateInfo } from "@/api/update.api";
import { useTranslation } from "@/i18n";
import { UpdateReleaseNotes } from "./UpdateReleaseNotes";
import { extractReleaseNotes } from "../utils/releaseNotes";
import { formatUpdateDate } from "../utils/updateFormat";

interface UpdateReleaseCardProps {
  info: UpdateInfo;
}

export function UpdateReleaseCard({ info }: UpdateReleaseCardProps) {
  const { locale, t } = useTranslation();
  const releasedAt = formatUpdateDate(info.date);
  const notes = extractReleaseNotes(info.body, locale);

  return (
    <section className="rounded-lg border border-border bg-bg-primary">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileText size={16} className="text-text-secondary" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-text-primary">{t("update.releaseNotes")}</h3>
        {releasedAt && <span className="ml-auto text-xs text-text-secondary">{releasedAt}</span>}
      </header>
      <div className="px-4 py-3">
        {notes ? (
          <UpdateReleaseNotes content={notes} />
        ) : (
          <p className="text-sm text-text-secondary">{t("update.noNotes")}</p>
        )}
      </div>
    </section>
  );
}
