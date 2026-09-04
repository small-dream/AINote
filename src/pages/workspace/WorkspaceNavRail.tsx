import { lazy, Suspense, useState } from "react";
import { Clock3, CloudCheck, CloudOff, CloudSync, FileText, Search, Settings, Star, Tags, Trash2, TriangleAlert } from "lucide-react";
import { useSync } from "@/features/sync/hooks/useSync";
import { deriveSyncHeader, type SyncOperation } from "@/features/sync/utils/status";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

const LazyConflictMergeDialog = lazy(() => import("@/features/sync/components/ConflictMergeDialog").then(({ ConflictMergeDialog }) => ({ default: ConflictMergeDialog })));

interface WorkspaceNavRailProps {
  repoPath: string | null;
  startupSyncing: boolean;
}

const NAV_ITEMS = [
  { key: "app.notes", icon: FileText, sidebarTab: "tree" },
  { key: "app.recent", icon: Clock3, sidebarTab: undefined },
  { key: "app.favorites", icon: Star, sidebarTab: undefined },
  { key: "wiki.tags", icon: Tags, sidebarTab: "tags" },
  { key: "trash.title", icon: Trash2, sidebarTab: "trash" },
] as const;

const SYNC_ICON = { synced: CloudCheck, pending: CloudSync, conflict: TriangleAlert, offline: CloudOff } as const;
const SYNC_COLOR = { synced: "bg-success", pending: "bg-warning", conflict: "bg-danger", offline: "bg-text-secondary" } as const;
const NAV_BUTTON_CLASS = "group relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-primary/70 hover:text-text-secondary focus-visible:text-text-secondary";
const NAV_TOOLTIP_CLASS = "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

/** 独立于 App Shell 主体的功能导航轨道。 */
export function WorkspaceNavRail({ repoPath, startupSyncing }: WorkspaceNavRailProps) {
  const { t } = useTranslation();
  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center border-r border-border bg-bg-tertiary/55 px-2 pb-3" aria-label={t("app.workspaceNavigation")}>
      <div data-tauri-drag-region className="h-11 w-full shrink-0" aria-hidden="true" />
      <SyncNavButton repoPath={repoPath} startupSyncing={startupSyncing} />
      <SearchNavButton />
      <NavigationItems />
      <SettingsNavButton />
    </nav>
  );
}

function NavigationItems() {
  const { t } = useTranslation();
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {NAV_ITEMS.map(({ key, icon: Icon, sidebarTab: targetTab }) => {
        const label = t(key);
        const active = targetTab !== undefined && sidebarTab === targetTab;
        return <button key={key} type="button" aria-label={label} aria-current={active ? "page" : undefined} title={label} onClick={() => targetTab && setSidebarTab(targetTab)} className={`${NAV_BUTTON_CLASS} ${active ? "bg-bg-primary text-accent shadow-sm" : ""}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.9} /><span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{label}</span></button>;
      })}
    </div>
  );
}

function SearchNavButton() {
  const { t } = useTranslation();
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  return (
    <button
      type="button"
      aria-label={t("palette.searchNotes")}
      title={t("palette.searchNotes")}
      onClick={openPalette}
      className={`${NAV_BUTTON_CLASS} mb-1`}
    >
      <Search size={18} strokeWidth={1.9} />
      <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{t("palette.searchNotes")}</span>
    </button>
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

function SyncNavButton({ repoPath, startupSyncing }: WorkspaceNavRailProps) {
  const { locale, t } = useTranslation();
  const { online, syncNow, isSyncing, status, resolving } = useSync(repoPath);
  const [conflictOpen, setConflictOpen] = useState(false);
  const display = deriveSyncHeader(status, online, resolveSyncOperation(startupSyncing, isSyncing, resolving), locale);
  const hasConflict = display.tone === "conflict";
  const Icon = SYNC_ICON[display.tone];

  return (
    <>
      <button
        type="button"
        aria-label={hasConflict ? t("sync.resolveConflict") : display.buttonLabel}
        title={display.text}
        onClick={() => (hasConflict ? setConflictOpen(true) : syncNow.mutate())}
        disabled={display.busy || (!online && !hasConflict)}
        className={`group relative mb-4 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${SYNC_COLOR[display.tone]}`}
      >
        <Icon size={19} className={display.busy ? "animate-spin" : ""} />
        <span aria-hidden="true" className={NAV_TOOLTIP_CLASS}>{display.text}</span>
      </button>
      {conflictOpen ? <Suspense fallback={null}><LazyConflictMergeDialog repoPath={repoPath} open onClose={() => setConflictOpen(false)} /></Suspense> : null}
    </>
  );
}

function resolveSyncOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}
