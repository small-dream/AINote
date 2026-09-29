import { lazy, Suspense } from "react";
import { Clock3, CloudCheck, CloudOff, CloudSync, FileText, ListTodo, Lock, LockOpen, Settings, Star, Tags, Trash2, TriangleAlert } from "lucide-react";
import { NavCountBadge } from "@/components/atoms/NavCountBadge";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTodoNavBadge } from "@/features/todo/hooks/useTodoAlertCounts";
import type { SyncController } from "@/features/sync/hooks/useSync";
import { deriveSyncFailure, deriveSyncHeader, type SyncOperation } from "@/features/sync/utils/status";
import { useVaultLock } from "@/features/vault/hooks/useVaultLock";
import { useVaultStatusQuery } from "@/queries/vault.queries";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { VersionNavMenu } from "./VersionNavMenu";
import { NAV_SECTION_GAP_CLASS } from "./navSpacing";

const LazyConflictMergeDialog = lazy(() => import("@/features/sync/components/ConflictMergeDialog").then(({ ConflictMergeDialog }) => ({ default: ConflictMergeDialog })));

interface WorkspaceNavRailProps {
  repoPath: string | null;
  startupSyncing: boolean;
  sync: SyncController;
}

const NAV_ITEMS = [
  { key: "app.notes", icon: FileText, sidebarTab: "tree" },
  { key: "todo.title", icon: ListTodo, sidebarTab: "todo" },
  { key: "app.recent", icon: Clock3, sidebarTab: "recent" },
  { key: "app.favorites", icon: Star, sidebarTab: "favorites" },
  { key: "wiki.tags", icon: Tags, sidebarTab: "tags" },
] as const;

const SYNC_ICON = { synced: CloudCheck, pending: CloudSync, conflict: TriangleAlert, offline: CloudOff } as const;
const SYNC_COLOR = { synced: "bg-success", pending: "bg-warning", conflict: "bg-danger", offline: "bg-text-secondary" } as const;
const NAV_BUTTON_CLASS = "group relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-primary/70 hover:text-text-secondary focus-visible:text-text-secondary";
/** 独立于 App Shell 主体的功能导航轨道。 */
export function WorkspaceNavRail({ repoPath, startupSyncing, sync }: WorkspaceNavRailProps) {
  const { t } = useTranslation();
  return (
    <nav className="workspace-nav-rail flex w-[72px] shrink-0 flex-col items-center gap-1.5 border-r border-border bg-bg-tertiary px-2 pb-3" aria-label={t("app.workspaceNavigation")}>
      <div data-tauri-drag-region className="h-11 w-full shrink-0" aria-hidden="true" />
      <SyncNavButton repoPath={repoPath} startupSyncing={startupSyncing} sync={sync} />
      <NavigationItems repoPath={repoPath} />
      <VersionNavMenu repoPath={repoPath} hasUncommitted={sync.status.hasUncommitted} buttonClass={NAV_BUTTON_CLASS} />
      <TrashNavButton />
      <VaultNavButton repoPath={repoPath} />
      <SettingsNavButton />
    </nav>
  );
}

function NavigationItems({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  // 待办入口常驻显示逾期 / 今日到期的数量角标（无待处理任务时不渲染）
  const todoBadge = useTodoNavBadge(repoPath);
  return (
    <>
      {NAV_ITEMS.map(({ key, icon: Icon, sidebarTab: targetTab }, index) => {
        const label = t(key);
        const active = sidebarTab === targetTab;
        const badge = targetTab === "todo" ? todoBadge : null;
        return (
          <Tooltip key={key} content={label} placement="right">
            <button type="button" aria-label={badge?.ariaLabel ?? label} aria-current={active ? "page" : undefined} onClick={() => setSidebarTab(targetTab)} className={`${NAV_BUTTON_CLASS} ${index === 0 ? NAV_SECTION_GAP_CLASS : ""} ${active ? "bg-bg-primary text-accent shadow-sm" : ""}`}>
              <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
              {badge ? <NavCountBadge count={badge.count} tone={badge.tone} /> : null}
            </button>
          </Tooltip>
        );
      })}
    </>
  );
}

function TrashNavButton() {
  const { t } = useTranslation();
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const active = sidebarTab === "trash";
  return (
    // mt-auto 必须落在 Tooltip 外层 span 上：它才是导航轨的 flex item，
    // 加在按钮上只会被包一层外壳吞掉，系统组不会贴底。
    <Tooltip content={t("trash.title")} placement="right" className="mt-auto">
      <button type="button" aria-label={t("trash.title")} aria-current={active ? "page" : undefined} onClick={() => useUiStore.getState().setSidebarTab("trash")} className={`${NAV_BUTTON_CLASS} ${active ? "bg-bg-primary text-accent shadow-sm" : ""}`}>
        <Trash2 size={18} strokeWidth={active ? 2.3 : 1.9} />
      </button>
    </Tooltip>
  );
}

/** 加密笔记状态入口（贴近系统区）：未建库不显示；已锁定点开全局解锁弹层，已解锁一键锁定。 */
function VaultNavButton({ repoPath }: { repoPath: string | null }) {
  const { t } = useTranslation();
  const status = useVaultStatusQuery(repoPath);
  const { lockNow, pending } = useVaultLock();
  const state = status.data?.state;
  if (state === "absent" || state === undefined) return null;
  const unlocked = state === "unlocked";
  const Icon = unlocked ? LockOpen : Lock;
  const label = unlocked ? t("vault.navUnlocked") : t("vault.navLocked");
  return (
    <Tooltip content={label} placement="right">
      <button
        type="button"
        aria-label={label}
        disabled={pending}
        onClick={() => (unlocked ? lockNow() : useUiStore.getState().openVaultDialog())}
        className={`${NAV_BUTTON_CLASS} ${unlocked ? "text-accent" : "text-warning"}`}
      >
        <Icon size={18} strokeWidth={unlocked ? 2.3 : 1.9} />
      </button>
    </Tooltip>
  );
}

function SettingsNavButton() {
  const { t } = useTranslation();
  return (
    <Tooltip content={t("settings.title")} placement="right">
      <button type="button" aria-label={t("settings.title")} onClick={() => useUiStore.getState().openSettings()} className={NAV_BUTTON_CLASS}>
        <Settings size={18} />
      </button>
    </Tooltip>
  );
}

function SyncNavButton({ repoPath, startupSyncing, sync }: WorkspaceNavRailProps) {
  const { locale, t } = useTranslation();
  const { online, syncNow, isSyncing, status, resolving } = sync;
  const conflictOpen = useUiStore((state) => state.conflictDialogOpen);
  const closeConflictDialog = useUiStore((state) => state.closeConflictDialog);
  const display = deriveSyncHeader(status, online, resolveSyncOperation(startupSyncing, isSyncing, resolving), locale);
  const failure = deriveSyncFailure(syncNow.error, locale);
  const hasConflict = display.tone === "conflict";
  const tone = failure && !hasConflict ? "conflict" : display.tone;
  const Icon = SYNC_ICON[tone];
  const label = hasConflict ? t("sync.resolveConflict") : (failure?.title ?? display.buttonLabel);
  const tip = failure ? `${failure.title} · ${t("sync.failedStage", { stage: failure.stage })}` : display.text;

  return (
    <>
      <Tooltip content={tip} placement="right">
        <button
          type="button"
          aria-label={label}
          onClick={() => (hasConflict ? useUiStore.getState().openConflictDialog() : syncNow.mutate())}
          disabled={display.busy || (!online && !hasConflict)}
          className={`group relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${SYNC_COLOR[tone]}`}
        >
          <Icon size={19} className={display.busy ? "animate-spin" : ""} />
        </button>
      </Tooltip>
      {conflictOpen ? <Suspense fallback={null}><LazyConflictMergeDialog repoPath={repoPath} open onClose={closeConflictDialog} /></Suspense> : null}
    </>
  );
}

function resolveSyncOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}
