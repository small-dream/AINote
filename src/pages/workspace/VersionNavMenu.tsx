import { lazy, Suspense, useState } from "react";
import { GitBranch, GitCommitHorizontal, GitGraph, RotateCcw } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import { ToolbarMenu, type ToolbarMenuEntry } from "@/components/molecules/ToolbarMenu";
import { NAV_SECTION_GAP_CLASS } from "./navSpacing";

const LazyCommitDialog = lazy(() => import("@/features/commit/components/CommitDialog").then(({ CommitDialog }) => ({ default: CommitDialog })));
const LazyDiscardDialog = lazy(() => import("@/features/discard/components/DiscardDialog").then(({ DiscardDialog }) => ({ default: DiscardDialog })));
const LazyGitGraphPanel = lazy(() => import("@/features/git-graph/components/GitGraphPanel").then(({ GitGraphPanel }) => ({ default: GitGraphPanel })));

type VersionDialog = "commit" | "discard" | "graph";

/**
 * 「版本」入口：合并提交 / 丢弃 / 图谱三个语义近邻的 Git 入口为导航轨单个按钮，
 * 降低图标噪音与误点率；「丢弃」以危险样式呈现，确认流程仍在 DiscardDialog 内完成。
 * 未提交变更徽标从原「提交」按钮上移到该入口。
 */
export function VersionNavMenu({ repoPath, hasUncommitted, buttonClass }: { repoPath: string | null; hasUncommitted: boolean; buttonClass: string }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<VersionDialog | null>(null);
  const entries: ToolbarMenuEntry[] = [
    { key: "commit", icon: GitCommitHorizontal, label: t("commit.title"), onSelect: () => setDialog("commit") },
    { key: "discard", icon: RotateCcw, label: t("discard.title"), tone: "danger", onSelect: () => setDialog("discard") },
    { key: "graph", icon: GitGraph, label: t("graph.title"), onSelect: () => setDialog("graph") },
  ];
  return (
    <>
      <ToolbarMenu
        icon={GitBranch}
        label={t("nav.version")}
        entries={entries}
        align="start"
        className={NAV_SECTION_GAP_CLASS}
        trigger={({ open, toggle }) => (
          <Tooltip content={t("nav.version")} placement="right">
            <button type="button" aria-label={t("nav.version")} aria-haspopup="menu" aria-expanded={open} onClick={toggle} className={`${buttonClass} relative ${open ? "text-text-secondary" : ""}`}>
              <GitBranch size={18} strokeWidth={open ? 2.3 : 1.9} />
              {hasUncommitted ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" aria-hidden="true" /> : null}
            </button>
          </Tooltip>
        )}
      />
      {dialog === "commit" ? (
        <Suspense fallback={null}>
          <LazyCommitDialog repoPath={repoPath} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
      {dialog === "discard" ? (
        <Suspense fallback={null}>
          <LazyDiscardDialog repoPath={repoPath} onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
      {dialog === "graph" ? (
        <Suspense fallback={null}>
          <LazyGitGraphPanel repoPath={repoPath} open onClose={() => setDialog(null)} />
        </Suspense>
      ) : null}
    </>
  );
}
