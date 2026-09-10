import { X } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { useBackHandler } from "@/platform/back-navigation";
import { DiffView } from "@/features/history/components/DiffView";
import { formatDate } from "@/features/history/utils/format";
import type { RepoCommit } from "@/api/types";
import type { ChangedFile } from "@/api/types";
import { useRepoGraph } from "../hooks/useRepoGraph";

interface GitGraphPanelProps {
  repoPath: string | null;
  open: boolean;
  onClose: () => void;
}

const FILE_STATUS_LABEL: Record<ChangedFile["status"], TranslationKey> = {
  added: "commit.added",
  modified: "commit.modified",
  deleted: "commit.deleted",
};

/** Repo Git Graph（阶段 B）：全仓提交 + 每 commit 改动文件 + diff + 恢复。 */
export function GitGraphPanel({ repoPath, open, onClose }: GitGraphPanelProps) {
  const { t } = useTranslation();
  const graph = useRepoGraph(repoPath);
  useBackHandler(open, onClose);
  if (!open) return null;

  return (
    <div
      data-mobile-overlay="graph"
      className="fixed inset-0 z-50 bg-black/40"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("graph.title")}
        className="mx-auto mt-10 flex h-[78vh] w-[min(1080px,94vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl"
      >
        <GraphHeader onClose={onClose} />
        <div className="graph-panel-body flex min-h-0 flex-1">
          <GraphCommitList
            commits={graph.commits}
            loading={graph.loading}
            selectedId={graph.activeCommit}
            onSelect={graph.onSelectCommit}
          />
          <GraphFileList
            files={graph.activeCommitData?.files ?? []}
            commitId={graph.activeCommit}
            selectedFile={graph.activeFile}
            onSelect={graph.onSelectFile}
          />
          <GraphDiffPane graph={graph} />
        </div>
      </div>
    </div>
  );
}

function GraphHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="text-sm font-semibold">{t("graph.title")}</h2>
      <button
        type="button"
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function GraphCommitList({ commits, loading, selectedId, onSelect }: { commits: RepoCommit[]; loading: boolean; selectedId: string | null; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <section className="graph-commit-list flex min-h-0 w-64 shrink-0 flex-col border-r border-border">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {t("graph.commits")}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("common.loading")}</p>
        ) : commits.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("graph.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {commits.map((commit) => (
              <li key={commit.id}>
                <button
                  type="button"
                  onClick={() => onSelect(commit.id)}
                  className={`w-full px-3 py-2.5 text-left transition-colors ${commit.id === selectedId ? "bg-accent/10" : "hover:bg-bg-secondary"}`}
                >
                  <p className="truncate text-sm font-medium text-text-primary">{commit.message}</p>
                  <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
                    {commit.author} · {formatDate(commit.timestamp)} · {commit.shortId}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {t("graph.fileCount", { count: commit.files.length })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function GraphFileList({ files, commitId, selectedFile, onSelect }: { files: ChangedFile[]; commitId: string | null; selectedFile: string | null; onSelect: (path: string) => void }) {
  const { t } = useTranslation();
  return (
    <section className="graph-file-list flex min-h-0 w-64 shrink-0 flex-col border-r border-border">
      <header className="shrink-0 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {t("graph.files")}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!commitId ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("graph.selectCommit")}</p>
        ) : files.length === 0 ? (
          <p className="px-3 py-3 text-sm text-text-tertiary">{t("graph.noFiles")}</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => onSelect(file.path)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${file.path === selectedFile ? "bg-accent/10" : "hover:bg-bg-secondary"}`}
                >
                  <span title={t(FILE_STATUS_LABEL[file.status])} className="w-5 shrink-0 text-center font-mono text-xs" data-commit-status={file.status}>
                    {file.status === "added" ? "A" : file.status === "deleted" ? "D" : "M"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">{file.path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface GraphDiffPaneProps {
  graph: ReturnType<typeof useRepoGraph>;
}

function GraphDiffPane({ graph }: GraphDiffPaneProps) {
  const { t } = useTranslation();
  const commit = graph.activeCommitData;
  const restoreError = graph.restoreError;
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-border">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-h-0 min-w-0">
          <p className="truncate text-sm font-medium">{commit?.message ?? t("graph.selectCommit")}</p>
          <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
            {commit ? `${commit.author} · ${formatDate(commit.timestamp)} · ${commit.shortId}` : ""}
          </p>
        </div>
        {graph.activeFile && graph.activeCommit && (
          <RestoreButton restoring={graph.restoring} onRestore={graph.handleRestore} />
        )}
      </div>
      {restoreError && <p className="border-b border-border px-4 py-2 text-xs text-danger">{restoreError.message}</p>}
      {!graph.activeFile ? (
        <p className="px-4 py-3 text-sm text-text-tertiary">{t("graph.selectFile")}</p>
      ) : (
        <DiffView diff={graph.diff} loading={graph.diffLoading} />
      )}
    </section>
  );
}

function RestoreButton({ restoring, onRestore }: { restoring: boolean; onRestore: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onRestore}
      disabled={restoring}
      className="shrink-0 rounded-md bg-accent px-2.5 py-1.5 text-xs text-white shadow-sm transition-colors hover:brightness-95 disabled:opacity-50"
    >
      {restoring ? t("history.restoring") : t("graph.restore")}
    </button>
  );
}
