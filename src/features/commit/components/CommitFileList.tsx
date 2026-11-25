import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import type { ChangedFile } from "@/api/types";
import { STATUS_LETTER } from "../utils/message";

const STATUS_TITLE: Record<ChangedFile["status"], TranslationKey> = {
  added: "commit.added",
  modified: "commit.modified",
  deleted: "commit.deleted",
};

interface CommitFileListProps {
  files: ChangedFile[];
  loading: boolean;
  activePath: string | null;
  onSelect: (path: string) => void;
}

/** 提交面板左侧文件列表：点击文件在右侧预览相对 HEAD 的改动。 */
export function CommitFileList({ files, loading, activePath, onSelect }: CommitFileListProps) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("commit.files")}
      className="commit-file-list flex h-72 min-h-0 w-64 shrink-0 flex-col overflow-hidden rounded-md border border-border bg-bg-tertiary/40"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("common.loading")}</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("commit.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((file) => {
              const active = file.path === activePath;
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.path)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                      active ? "bg-accent/10" : "hover:bg-bg-secondary"
                    }`}
                  >
                    <Tooltip content={t(STATUS_TITLE[file.status])} portal>
                      <span className="w-5 shrink-0 text-center font-mono text-xs" data-commit-status={file.status}>
                        {STATUS_LETTER[file.status]}
                      </span>
                    </Tooltip>
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{file.path}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
