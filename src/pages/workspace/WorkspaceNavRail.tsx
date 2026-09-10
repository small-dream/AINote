import { lazy, Suspense, useState } from "react";
import { Clock3, CloudCheck, CloudOff, CloudSync, FileText, GitCommitHorizontal, GitGraph, Settings, Star, Tags, Trash2, TriangleAlert } from "lucide-react";
import type { SyncController } from "@/features/sync/hooks/useSync";
import { deriveSyncFailure, deriveSyncHeader, type SyncOperation } from "@/features/sync/utils/status";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

const LazyConflictMergeDialog = lazy(() => import("@/features/sync/components/ConflictMergeDialog").then(({ ConflictMergeDialog }) => ({ default: ConflictMergeDialog })));
const LazyCommitDialog = lazy(() => import("@/features/commit/components/CommitDialog").then(({ CommitDialog }) => ({ default: CommitDialog })));
const LazyGitGraphPanel = lazy(() => import("@/features/git-graph/components/GitGraphPanel").then(({ GitGraphPanel }) => ({ default: GitGraphPanel })));

interface WorkspaceNavRailProps {
  repoPath: string | null;
  startupSyncing: boolean;
  sync: SyncController;
}

const NAV_ITEMS = [
  { key: "app.notes", icon: FileText, sidebarTab: "tree" },
  { key: "app.recent", icon: Clock3, sidebarTab: "recent" },
  { key: "app.favorites", icon: Star, sidebarTab: "favorites" },
  { key: "wiki.tags", icon: Tags, sidebarTab: "tags" },
  { key: "trash.title", icon: Trash2, sidebarTab: "trash" },
] as const;

const SYNC_ICON = { synced: CloudCheck, pending: CloudSync, conflict: TriangleAlert, offline: CloudOff } as const;
const SYNC_COLOR = { synced: "bg-success", pending: "bg-warning", conflict: "bg-danger", offline: "bg-text-secondary" } as const;
const NAV_BUTTON_CLASS = "group relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-primary/70 hover:text-text-secondary focus-visible:text-text-secondary";
const NAV_TOOLTIP_CLASS = "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

/** 独立于 App Shell 主体的功能导航轨道。 */
export function WorkspaceNavRail({ repoPath, startupSyncing, sync }: WorkspaceNavRailProps) {
  const { t } = useTranslation();
  return (
    <nav className="workspace-nav-rail flex w-[72px] shrink-0 flex-col items-center border-r border-border bg-bg-tertiary px-2 pb-3" aria-label={t("app.workspaceNavigation")}>
      <div data-tauri-drag-region className="h-11 w-full shrink-0" aria-hidden="true" />
      <SyncNavButton repoPath={repoPath} startupSyncing={startupSyncing} sync={sync} />
      <NavigationItems />
      <CommitNavButton repoPath={repoPath} sync={sync} />
      <GraphNavButton repoPath={repoPath} />
      <SettingsNavButton />
    </nav>
  );
}

function NavigationItems() {
  const { t } = useTranslation();
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  return (
    <div className="mb-4 flex w-full flex-col items-center gap-1.5">
      {NAV_ITEMS.map(({ key, icon: Icon, sidebarTab: targetTab }) => {
        const label = t(key);
        const active = sidebarTab === targetTab;
        return <button key={key} type="button" aria-label={label} aria-current={active ? "page" : undefined} title={label} onClick={() => setSidebarTab(targetTab)} className={`${NAV_BUTTON_CLASS} ${active ? "bg-bg-primary text-accent shadow-sm" : ""}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.9} /><span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{label}</span></button>;
      })}
    </div>
  );
}

function SettingsNavButton() {
  const { t } = useTranslation();
  return (
    <button type="button" aria-label={t("settings.title")} title={t("settings.title")} onClick={() => useUiStore.getState().openSettings()} className={`${NAV_BUTTON_CLASS} mt-auto`}>
      <Settings size={18} />
      <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{t("settings.title")}</span>
    </button>
  );
}

function SyncNavButton({ repoPath, startupSyncing, sync }: WorkspaceNavRailProps) {
  const { locale, t } = useTranslation();
  const { online, syncNow, isSyncing, status, resolving } = sync;
  const [conflictOpen, setConflictOpen] = useState(false);
  const display = deriveSyncHeader(status, online, resolveSyncOperation(startupSyncing, isSyncing, resolving), locale);
  const failure = deriveSyncFailure(syncNow.error, locale);
  const hasConflict = display.tone === "conflict";
  const tone = failure && !hasConflict ? "conflict" : display.tone;
  const Icon = SYNC_ICON[tone];
  const label = hasConflict ? t("sync.resolveConflict") : (failure?.title ?? display.buttonLabel);
  const tip = failure ? `${failure.title} · ${t("sync.failedStage", { stage: failure.stage })}` : display.text;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={tip}
        onClick={() => (hasConflict ? setConflictOpen(true) : syncNow.mutate())}
        disabled={display.busy || (!online && !hasConflict)}
        className={`group relative mb-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${SYNC_COLOR[tone]}`}
      >
        <Icon size={19} className={display.busy ? "animate-spin" : ""} />
        <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{tip}</span>
      </button>
      {conflictOpen ? <Suspense fallback={null}><LazyConflictMergeDialog repoPath={repoPath} open onClose={() => setConflictOpen(false)} /></Suspense> : null}
    </>
  );
}

/** 手动提交入口：有待提交变更时显示徽标，点击打开提交面板。 */
function CommitNavButton({ repoPath, sync }: { repoPath: string | null; sync: SyncController }) {
  const { t } = useTranslation();
  const [commitOpen, setCommitOpen] = useState(false);
  const hasUncommitted = sync.status.hasUncommitted;
  return (
    <>
      <button
        type="button"
        aria-label={t("commit.title")}
        title={t("commit.title")}
        onClick={() => setCommitOpen(true)}
        className={`${NAV_BUTTON_CLASS} relative mb-4`}
      >
        <GitCommitHorizontal size={18} />
        {hasUncommitted ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" aria-hidden="true" /> : null}
        <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{t("commit.title")}</span>
      </button>
      {commitOpen ? (
        <Suspense fallback={null}>
          <LazyCommitDialog repoPath={repoPath} onClose={() => setCommitOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}

/** Repo Git Graph 入口：全仓提交历史与每 commit 改动文件（阶段 B）。 */
function GraphNavButton({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const [graphOpen, setGraphOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t("graph.title")}
        title={t("graph.title")}
        onClick={() => setGraphOpen(true)}
        className={`${NAV_BUTTON_CLASS} mb-4`}
      >
        <GitGraph size={18} />
        <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{t("graph.title")}</span>
      </button>
      {graphOpen ? (
        <Suspense fallback={null}>
          <LazyGitGraphPanel repoPath={repoPath} open onClose={() => setGraphOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}

function resolveSyncOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}
