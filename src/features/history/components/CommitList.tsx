import { useTranslation } from "@/i18n";
import type { CommitInfo } from "../types";
import { formatDate } from "../utils/format";

interface CommitListProps {
  commits: CommitInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 提交列表（左栏）：消息 + 作者日期 + 短哈希 */
export function CommitList({ commits, selectedId, onSelect }: CommitListProps) {
  const { t } = useTranslation();
  if (commits.length === 0) {
    return (
      <div className="flex w-64 shrink-0 items-center justify-center p-4 text-center text-sm text-text-tertiary">
        {t("history.noHistory")}
      </div>
    );
  }
  return (
    <ul className="w-64 shrink-0 overflow-y-auto border-r border-border py-1">
      {commits.map((commit) => (
        <li key={commit.id}>
          <button
            type="button"
            onClick={() => onSelect(commit.id)}
            className={`w-full px-3 py-2.5 text-left ${commit.id === selectedId ? "bg-bg-tertiary" : "hover:bg-bg-tertiary/60"}`}
          >
            <p className="truncate text-[13px] font-medium text-text-primary">{commit.message}</p>
            <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
              {commit.author} · {formatDate(commit.timestamp)}
            </p>
            <p className="mt-0.5 text-[10px] text-text-tertiary">{commit.shortId}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
