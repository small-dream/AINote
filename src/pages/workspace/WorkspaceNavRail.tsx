import { useState } from "react";
import { Clock3, CloudCheck, CloudOff, CloudSync, FileText, LogOut, Search, Settings, Star, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { authApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { ConflictMergeDialog } from "@/features/sync/components/ConflictMergeDialog";
import { RepoManager } from "@/features/settings/components/RepoManager";
import { ThemeSettings } from "@/features/settings/components/ThemeSettings";
import { LanguageSettings } from "@/features/settings/components/LanguageSettings";
import { UpdateSettings } from "@/features/update/components/UpdateSettings";
import { useSync } from "@/features/sync/hooks/useSync";
import { deriveSyncHeader, type SyncOperation } from "@/features/sync/utils/status";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useSessionStore } from "@/stores/session.store";
import { useTranslation } from "@/i18n";

interface WorkspaceNavRailProps {
  repoPath: string | null;
  startupSyncing: boolean;
}

const NAV_ITEMS = [
  { key: "app.notes", icon: FileText, active: true },
  { key: "app.recent", icon: Clock3, active: false },
  { key: "app.favorites", icon: Star, active: false },
] as const;

const SYNC_ICON = { synced: CloudCheck, pending: CloudSync, conflict: TriangleAlert, offline: CloudOff } as const;
const SYNC_COLOR = { synced: "bg-success", pending: "bg-warning", conflict: "bg-danger", offline: "bg-text-secondary" } as const;

/** 独立于 App Shell 主体的功能导航轨道。 */
export function WorkspaceNavRail({ repoPath, startupSyncing }: WorkspaceNavRailProps) {
  const { t } = useTranslation();
  return (
    <nav className="flex w-[88px] shrink-0 flex-col items-center border-r border-border bg-bg-tertiary/55 px-2 pb-3 pt-11" aria-label={t("app.workspaceNavigation")}>
      <SyncNavButton repoPath={repoPath} startupSyncing={startupSyncing} />
      <SearchNavButton />
      <NavigationItems />
      <SettingsNavButton />
    </nav>
  );
}

function NavigationItems() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      {NAV_ITEMS.map(({ key, icon: Icon, active }) => {
        const label = t(key);
        return <button key={key} type="button" aria-label={label} title={label} className={`flex w-14 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] transition-colors ${active ? "bg-bg-primary text-accent shadow-sm" : "text-text-tertiary hover:bg-bg-primary/70 hover:text-text-secondary"}`}><Icon size={18} strokeWidth={active ? 2.3 : 1.9} /><span>{label}</span></button>;
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
      className="mb-1 flex w-14 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-primary/70 hover:text-text-secondary"
    >
      <Search size={18} strokeWidth={1.9} />
      <span>{t("palette.searchNotes")}</span>
    </button>
  );
}

function SettingsNavButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useSessionStore((state) => state.reset);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function handleLogout() {
    setBusy(true);
    try {
      await authApi.logout();
      reset();
      navigate("/setup", { replace: true });
    } finally {
      setBusy(false);
    }
  }
  return (<>
      <button type="button" aria-label={t("settings.title")} title={t("settings.title")} onClick={() => setOpen(true)} className="mt-auto flex w-14 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] text-text-tertiary transition-colors hover:bg-bg-primary/70 hover:text-text-secondary">
        <Settings size={18} />
        <span>{t("settings.title")}</span>
      </button>
      <Modal open={open} title={t("settings.title")} onClose={() => setOpen(false)}>
        <RepoManager />
        <hr className="my-5 border-border" />
        <ThemeSettings />
        <hr className="my-5 border-border" />
        <LanguageSettings />
        <hr className="my-5 border-border" />
        <UpdateSettings />
        <hr className="my-5 border-border" />
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("settings.account")}</h3>
          <Button variant="ghost" className="inline-flex items-center gap-2 border border-border text-sm" onClick={() => void handleLogout()} disabled={busy}>
            <LogOut size={15} />
            {busy ? t("settings.loggingOut") : t("settings.logout")}
          </Button>
        </div>
      </Modal>
    </>);
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
        className={`mb-4 grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${SYNC_COLOR[display.tone]}`}
      >
        <Icon size={19} className={display.busy ? "animate-spin" : ""} />
      </button>
      <ConflictMergeDialog repoPath={repoPath} open={conflictOpen} onClose={() => setConflictOpen(false)} />
    </>
  );
}

function resolveSyncOperation(startupSyncing: boolean, isSyncing: boolean, resolving: boolean): SyncOperation {
  if (startupSyncing) return "startup";
  if (isSyncing) return "syncing";
  if (resolving) return "resolving";
  return null;
}
