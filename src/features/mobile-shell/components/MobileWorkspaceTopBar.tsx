import { ArrowLeft, GitCommitHorizontal, Minimize2, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import { useUiStore } from "@/stores/ui.store";
import { SyncNotice } from "@/features/sync/components/SyncNotice";
import type { useSync } from "@/features/sync/hooks/useSync";
import { MobileVaultButton } from "./MobileVaultButton";
import { MobileIconButton } from "./MobileButtons";

interface MobileWorkspaceTopBarProps {
  focused: boolean;
  repoPath: string | null;
  showEditor: boolean;
  title: string;
  sync: ReturnType<typeof useSync>;
  onBack: () => void;
  onExitFocus: () => void;
  onOpenCommit: () => void;
  onOpenDiscard: () => void;
}

/** 移动端顶栏：专注模式只保留返回与退出，避免同步/搜索控件抢占正文空间。 */
export function MobileWorkspaceTopBar({ focused, repoPath, showEditor, title, sync, onBack, onExitFocus, onOpenCommit, onOpenDiscard }: MobileWorkspaceTopBarProps) {
  if (focused) return <MobileFocusHeader title={title} onBack={onBack} onExit={onExitFocus} />;
  const { online, status, label, syncNow, isSyncing } = sync;
  return (
    <>
      <MobileHeader
        repoPath={repoPath}
        showEditor={showEditor}
        title={title}
        online={online}
        label={label.text}
        tone={label.tone}
        isSyncing={isSyncing}
        conflicted={status.conflicted}
        onBack={onBack}
        onSync={() => syncNow.mutate()}
        hasUncommitted={status.hasUncommitted}
        onOpenCommit={onOpenCommit}
        onOpenDiscard={onOpenDiscard}
        onOpenConflict={() => useUiStore.getState().openConflictDialog()}
      />
      <SyncNotice sync={sync} />
    </>
  );
}

function MobileFocusHeader({ title, onBack, onExit }: { title: string; onBack: () => void; onExit: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="mobile-workspace-header flex min-h-12 shrink-0 items-center gap-2 border-b border-border bg-bg-primary px-3 pt-[env(safe-area-inset-top)]">
      <MobileIconButton label={t("mobile.backToList")} icon={ArrowLeft} onClick={onBack} />
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-text-secondary">{title}</h1>
      <MobileIconButton label={t("editor.exitFocusMode")} icon={Minimize2} onClick={onExit} />
    </header>
  );
}

function MobileHeader({ repoPath, showEditor, title, online, label, tone, isSyncing, conflicted, hasUncommitted, onBack, onSync, onOpenCommit, onOpenDiscard, onOpenConflict }: { repoPath: string | null; showEditor: boolean; title: string; online: boolean; label: string; tone: string; isSyncing: boolean; conflicted: boolean; hasUncommitted: boolean; onBack: () => void; onSync: () => void; onOpenCommit: () => void; onOpenDiscard: () => void; onOpenConflict: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="mobile-workspace-header flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-bg-primary px-3 pt-[env(safe-area-inset-top)]">
      {showEditor ? <MobileIconButton label={t("mobile.backToList")} icon={ArrowLeft} onClick={onBack} /> : null}
      <h1 className={`min-w-0 flex-1 truncate font-semibold ${showEditor ? "text-sm font-medium text-text-secondary" : "text-lg"}`}>{title}</h1>
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
      {hasUncommitted ? <MobileIconButton label={t("commit.title")} icon={GitCommitHorizontal} onClick={onOpenCommit} /> : null}
      {hasUncommitted ? <MobileIconButton label={t("discard.title")} icon={RotateCcw} onClick={onOpenDiscard} /> : null}
      <MobileVaultButton repoPath={repoPath} />
      <MobileIconButton label={t("sync.now")} icon={RefreshCw} onClick={onSync} disabled={!online || isSyncing} spinning={isSyncing} />
      {!showEditor ? <MobileSearchButton /> : null}
    </header>
  );
}

function MobileSearchButton() {
  const { t } = useTranslation();
  return <MobileIconButton label={t("palette.searchNotes")} icon={Search} onClick={useCommandPaletteStore.getState().openPalette} />;
}
