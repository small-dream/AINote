import { useTranslation } from "@/i18n";
import { Tooltip } from "@/components/atoms/Tooltip";
import type { TranslationKey } from "@/i18n/messages";
import type { ChangedFile } from "@/api/types";
import { STATUS_LETTER } from "@/features/commit/utils/message";

const STATUS_TITLE: Record<ChangedFile["status"], TranslationKey> = {
  added: "commit.added",
  modified: "commit.modified",
  deleted: "commit.deleted",
};

interface DiscardFileListProps {
  files: ChangedFile[];
  loading: boolean;
  allSelected: boolean;
  selectedCount: number;
  isSelected: (path: string) => boolean;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
}

/** 丢弃面板的变更列表：全选行 + 逐文件勾选（状态字母与提交面板同一口径）。 */
export function DiscardFileList({ files, loading, allSelected, selectedCount, isSelected, onToggle, onToggleAll }: DiscardFileListProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-text-secondary">
          <input type="checkbox" checked={allSelected} onChange={onToggleAll} disabled={files.length === 0} />
          {t("discard.selectAll")}
        </label>
        <span className="text-text-tertiary">
          {t("discard.selectedCount", { selected: selectedCount, total: files.length })}
        </span>
      </div>
      <div className="max-h-56 min-h-0 overflow-y-auto rounded-md border border-border bg-bg-tertiary/40">
        {loading ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("common.loading")}</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("discard.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((file) => (
              <li key={file.path}>
                <label className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <input type="checkbox" checked={isSelected(file.path)} onChange={() => onToggle(file.path)} />
                  <Tooltip content={t(STATUS_TITLE[file.status])}>
                    <span className="w-5 shrink-0 text-center font-mono text-xs" data-discard-status={file.status}>
                      {STATUS_LETTER[file.status]}
                    </span>
                  </Tooltip>
                  <span className="min-w-0 flex-1 truncate text-text-secondary">{file.path}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
