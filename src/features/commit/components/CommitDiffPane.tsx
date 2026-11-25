import { RefreshCw } from "lucide-react";
import { messageOf } from "@/api";
import { DiffView } from "@/components/molecules/DiffView";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import type { WorkingDiff } from "@/api/types";
import { summarizeDiff } from "../utils/diffSummary";

interface CommitDiffPaneProps {
  path: string | null;
  diff: WorkingDiff | undefined;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  onRefresh: () => void;
}

/** 提交面板右侧改动预览：文件相对 HEAD 的逐行 diff，含二进制 / 加密 / 截断状态。 */
export function CommitDiffPane({
  path,
  diff,
  loading,
  fetching,
  error,
  onRefresh,
}: CommitDiffPaneProps) {
  const { t } = useTranslation();
  const summary = diff && !diff.binary && !diff.encrypted ? summarizeDiff(diff.lines) : null;

  return (
    <section
      aria-label={t("commit.diffTitle")}
      className="commit-diff-pane flex h-72 min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-text-secondary">{path ?? t("commit.selectFile")}</p>
          {summary && summary.added + summary.removed > 0 ? (
            <p className="mt-0.5 text-[11px] text-text-tertiary">
              <span className="text-success">+{summary.added}</span>
              {" "}
              <span className="text-danger">−{summary.removed}</span>
            </p>
          ) : null}
        </div>
        <Tooltip content={t("commit.refreshDiff")} align="end">
          <button
            type="button"
            aria-label={t("commit.refreshDiff")}
            onClick={onRefresh}
            disabled={!path || fetching}
            className="shrink-0 rounded p-1 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-40"
          >
            <RefreshCw size={14} className={fetching ? "animate-spin" : undefined} />
          </button>
        </Tooltip>
      </div>
      <DiffBody path={path} diff={diff} loading={loading} error={error} />
    </section>
  );
}

interface DiffBodyProps {
  path: string | null;
  diff: WorkingDiff | undefined;
  loading: boolean;
  error: unknown;
}

function DiffBody({ path, diff, loading, error }: DiffBodyProps) {
  const { t } = useTranslation();
  if (!path) return <PaneMessage text={t("commit.selectFile")} />;
  if (error) return <PaneMessage text={messageOf(error)} tone="danger" />;
  if (loading) return <PaneMessage text={t("common.loading")} />;
  if (!diff) return <PaneMessage text={t("commit.selectFile")} />;
  if (diff.encrypted) return <PaneMessage text={t("commit.diffEncrypted")} />;
  if (diff.binary) return <PaneMessage text={t("commit.diffBinary")} />;
  if (diff.lines.length === 0) return <PaneMessage text={t("commit.diffNoChanges")} />;
  return (
    <>
      {diff.truncated ? (
        <p className="border-b border-border bg-warning/10 px-3 py-1.5 text-[11px] text-text-secondary">
          {t("commit.diffTruncated", { count: diff.lines.length })}
        </p>
      ) : null}
      <DiffView lines={diff.lines} loading={false} />
    </>
  );
}

function PaneMessage({ text, tone = "muted" }: { text: string; tone?: "muted" | "danger" }) {
  return (
    <div
      className={`flex min-h-0 flex-1 items-center justify-center p-4 text-center text-sm ${
        tone === "danger" ? "text-danger" : "text-text-tertiary"
      }`}
    >
      {text}
    </div>
  );
}
