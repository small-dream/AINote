import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, FileText, List, RefreshCw, Settings, type LucideIcon } from "lucide-react";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useSync } from "@/features/sync/hooks/useSync";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";

interface MobileWorkspaceShellProps {
  repoPath: string | null;
  currentNotePath: string | null;
  editorRef: RefObject<NoteEditorHandle | null>;
  sidebar: ReactNode;
  editor: ReactNode;
  onBackToList: () => void;
}

/** 移动端单栏工作区：列表与编辑器之间切换，业务内容由桌面组件复用。 */
export function MobileWorkspaceShell({ repoPath, currentNotePath, editorRef, sidebar, editor, onBackToList }: MobileWorkspaceShellProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"list" | "editor">(currentNotePath ? "editor" : "list");
  const sidebarTab = useUiStore((state) => state.sidebarTab);
  const setSidebarTab = useUiStore((state) => state.setSidebarTab);
  const { online, status, syncNow, isSyncing } = useSync(repoPath);
  const title = useMemo(() => currentNotePath?.split(/[\\/]/).pop() ?? t("app.notes"), [currentNotePath, t]);

  useEffect(() => {
    const onPopState = () => setView("list");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const showEditor = view === "editor" && currentNotePath !== null;
  const openEditor = () => {
    if (!showEditor) window.history.pushState({ ainoteMobileEditor: true }, "");
    setView("editor");
  };

  function handleBack() {
    void editorRef.current?.flush();
    if (showEditor && window.history.state?.ainoteMobileEditor) window.history.back();
    else setView("list");
    onBackToList();
  }

  return (
    <div className="mobile-workspace-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg-primary">
      <MobileHeader showEditor={showEditor} title={title} online={online} isSyncing={isSyncing} onBack={handleBack} onSync={() => syncNow.mutate()} />

      <main className="min-h-0 flex-1 overflow-hidden">
        {showEditor ? <div className="mobile-editor-pane h-full min-h-0">{editor}</div> : <div className="mobile-sidebar-pane h-full min-h-0 overflow-hidden">{sidebar}</div>}
      </main>

      <MobileBottomNav showEditor={showEditor} title={title} hasNote={currentNotePath !== null} favoritesActive={sidebarTab === "favorites"} onBack={handleBack} onOpenEditor={openEditor} onOpenFavorites={() => { setSidebarTab("favorites"); setView("list"); }} onOpenSettings={() => useUiStore.getState().openSettings()} />
      <span className="sr-only" aria-live="polite">{status.conflicted ? t("sync.conflict") : status.hasUncommitted ? t("sync.unsaved") : null}</span>
    </div>
  );
}

function MobileHeader({ showEditor, title, online, isSyncing, onBack, onSync }: { showEditor: boolean; title: string; online: boolean; isSyncing: boolean; onBack: () => void; onSync: () => void }) {
  const { t } = useTranslation();
  return <header className="mobile-workspace-header flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-bg-primary px-4 pt-[env(safe-area-inset-top)]">
    {showEditor ? <button type="button" className="mobile-icon-button" aria-label={t("settings.back")} title={t("settings.back")} onClick={onBack}><ArrowLeft size={20} /></button> : null}
    <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{showEditor ? title : t("app.notes")}</h1>
    <span className={`mobile-network-dot ${online ? "is-online" : ""}`} title={online ? t("sync.synced") : t("sync.offline")} aria-label={online ? t("sync.synced") : t("sync.offline")} />
    <button type="button" className="mobile-icon-button" aria-label={t("sync.now")} title={t("sync.now")} onClick={onSync} disabled={!online || isSyncing}><RefreshCw size={18} className={isSyncing ? "animate-spin" : ""} /></button>
  </header>;
}

function MobileBottomNav({ showEditor, title, hasNote, favoritesActive, onBack, onOpenEditor, onOpenFavorites, onOpenSettings }: { showEditor: boolean; title: string; hasNote: boolean; favoritesActive: boolean; onBack: () => void; onOpenEditor: () => void; onOpenFavorites: () => void; onOpenSettings: () => void }) {
  const { t } = useTranslation();
  return <nav className="mobile-bottom-nav flex min-h-16 shrink-0 items-stretch justify-around border-t border-border bg-bg-secondary pb-[env(safe-area-inset-bottom)]" aria-label={t("app.workspaceNavigation")}>
    <MobileNavButton active={!showEditor} label={t("app.notes")} icon={List} onClick={() => { if (showEditor) onBack(); }} />
    <MobileNavButton active={showEditor} label={title} icon={FileText} onClick={onOpenEditor} disabled={!hasNote} />
    <MobileNavButton active={favoritesActive && !showEditor} label={t("app.favorites")} icon={FileText} onClick={onOpenFavorites} />
    <MobileNavButton label={t("settings.title")} icon={Settings} onClick={onOpenSettings} />
  </nav>;
}

function MobileNavButton({ active = false, label, icon: Icon, onClick, disabled = false }: { active?: boolean; label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} aria-current={active ? "page" : undefined} disabled={disabled} onClick={onClick} className={`mobile-nav-button ${active ? "is-active" : ""}`}><Icon size={19} /><span>{label}</span></button>;
}
