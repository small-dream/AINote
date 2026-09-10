import { lazy, Suspense, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, Clock, FolderTree, Hash, List, RefreshCw, Search, Settings, Star, Trash2, type LucideIcon } from "lucide-react";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useSync } from "@/features/sync/hooks/useSync";
import { SyncNotice } from "@/features/sync/components/SyncNotice";
import { deriveSyncFailure } from "@/features/sync/utils/status";
import { MobileUpdateBanner } from "@/features/update/components/MobileUpdateBanner";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { useMobileEditorView } from "../hooks/useMobileEditorView";
import type { SidebarTab } from "@/stores/ui.store";

const LazyConflictMergeDialog = lazy(() => import("@/features/sync/components/ConflictMergeDialog").then(({ ConflictMergeDialog }) => ({ default: ConflictMergeDialog })));

interface MobileWorkspaceShellProps {
  repoPath: string | null;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  openEditorSignal: number;
  sidebar: ReactNode;
  editor: ReactNode;
  onBackToList: () => void;
}

/** 移动端单栏工作区：列表为根部，编辑器是详情路由。 */
export function MobileWorkspaceShell({ repoPath, currentNotePath, editorRef, openEditorSignal, sidebar, editor, onBackToList }: MobileWorkspaceShellProps) {
  const { locale, t } = useTranslation();
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  const sync = useSync(repoPath);
  const { online, status, label, syncNow, isSyncing } = sync;
  const failure = deriveSyncFailure(syncNow.error, locale);
  const [conflictOpen, setConflictOpen] = useState(false);
  const title = currentNotePath?.split(/[\\/]/).pop() ?? t("app.notes");
  const { showEditor, backToList } = useMobileEditorView({
    currentNotePath,
    openEditorSignal,
    onBackToList,
    onFlush: () => editorRef.current?.flush(),
  });

  return (
    <div className="mobile-workspace-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg-primary">
      <MobileHeader
        showEditor={showEditor}
        title={title}
        online={online}
        label={label.text}
        tone={label.tone}
        isSyncing={isSyncing}
        conflicted={status.conflicted}
        onBack={backToList}
        onSync={() => syncNow.mutate()}
        onOpenConflict={() => setConflictOpen(true)}
      />
      <SyncNotice sync={sync} />
      <MobileUpdateBanner />
      <main className="min-h-0 flex-1 overflow-hidden">
        {showEditor ? (
          <div className="mobile-editor-pane h-full min-h-0">{editor}</div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <MobileListTabs active={sidebarTab} onChange={setSidebarTab} />
            <div className="mobile-list-content min-h-0 flex-1 overflow-hidden">{sidebar}</div>
          </div>
        )}
      </main>
      {showEditor ? null : (
        <MobileBottomNav
          notesActive={sidebarTab === "tree"}
          favoritesActive={sidebarTab === "favorites"}
          onOpenNotes={() => setSidebarTab("tree")}
          onOpenFavorites={() => setSidebarTab("favorites")}
          onOpenSettings={() => useUiStore.getState().openSettings()}
        />
      )}
      {conflictOpen ? (
        <Suspense fallback={null}>
          <LazyConflictMergeDialog repoPath={repoPath} open onClose={() => setConflictOpen(false)} />
        </Suspense>
      ) : null}
      <span className="sr-only" aria-live="polite">{failure ? `${failure.title} · ${failure.suggestion}` : status.conflicted ? t("sync.conflict") : status.hasUncommitted ? t("sync.unsaved") : null}</span>
    </div>
  );
}

function MobileHeader({ showEditor, title, online, label, tone, isSyncing, conflicted, onBack, onSync, onOpenConflict }: { showEditor: boolean; title: string; online: boolean; label: string; tone: string; isSyncing: boolean; conflicted: boolean; onBack: () => void; onSync: () => void; onOpenConflict: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="mobile-workspace-header flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-bg-primary px-3 pt-[env(safe-area-inset-top)]">
      {showEditor ? <MobileIconButton label={t("mobile.backToList")} icon={ArrowLeft} onClick={onBack} /> : null}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{showEditor ? title : t("app.notes")}</h1>
      {conflicted ? (
        <button type="button" className={`mobile-sync-pill is-${tone}`} title={label} onClick={onOpenConflict}>
          <span className={`mobile-status-dot ${online ? "is-online" : ""}`} aria-hidden="true" />
          {label}
        </button>
      ) : (
        <span className={`mobile-sync-pill is-${tone}`} title={label}>
          <span className={`mobile-status-dot ${online ? "is-online" : ""}`} aria-hidden="true" />
          {label}
        </span>
      )}
      <MobileIconButton label={t("sync.now")} icon={RefreshCw} onClick={onSync} disabled={!online || isSyncing} spinning={isSyncing} />
      {!showEditor ? <MobileSearchButton /> : null}
    </header>
  );
}

function MobileSearchButton() {
  const { t } = useTranslation();
  return <MobileIconButton label={t("palette.searchNotes")} icon={Search} onClick={useCommandPaletteStore.getState().openPalette} />;
}

function MobileListTabs({ active, onChange }: { active: SidebarTab; onChange: (tab: SidebarTab) => void }) {
  const { t } = useTranslation();
  const tabs: { id: SidebarTab; label: string; icon: LucideIcon }[] = [
    { id: "tree", label: t("tree.label"), icon: FolderTree },
    { id: "recent", label: t("app.recent"), icon: Clock },
    { id: "favorites", label: t("app.favorites"), icon: Star },
    { id: "tags", label: t("wiki.tags"), icon: Hash },
    { id: "trash", label: t("trash.title"), icon: Trash2 },
  ];
  return (
    <div className="mobile-list-tabs flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-bg-primary px-2 py-1.5" role="tablist" aria-label={t("app.workspaceNavigation")}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} className={`mobile-list-tab ${active === id ? "is-active" : ""}`} onClick={() => onChange(id)}>
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function MobileBottomNav({ notesActive, favoritesActive, onOpenNotes, onOpenFavorites, onOpenSettings }: { notesActive: boolean; favoritesActive: boolean; onOpenNotes: () => void; onOpenFavorites: () => void; onOpenSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="mobile-bottom-nav flex min-h-16 shrink-0 items-stretch justify-around border-t border-border bg-bg-secondary pb-[env(safe-area-inset-bottom)]" aria-label={t("app.workspaceNavigation")}>
      <MobileNavButton active={notesActive} label={t("app.notes")} icon={List} onClick={onOpenNotes} />
      <MobileNavButton active={favoritesActive} label={t("app.favorites")} icon={Star} onClick={onOpenFavorites} />
      <MobileNavButton label={t("settings.title")} icon={Settings} onClick={onOpenSettings} />
    </nav>
  );
}

function MobileIconButton({ icon: Icon, label, onClick, disabled = false, spinning = false }: { icon: LucideIcon; label: string; onClick?: () => void; disabled?: boolean; spinning?: boolean }) {
  return (
    <button type="button" className="mobile-icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon size={20} className={spinning ? "animate-spin" : ""} />
    </button>
  );
}

function MobileNavButton({ active = false, label, icon: Icon, onClick }: { active?: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} aria-current={active ? "page" : undefined} onClick={onClick} className={`mobile-nav-button ${active ? "is-active" : ""}`}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}
