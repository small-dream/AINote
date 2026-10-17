import { lazy, Suspense, useState, type ReactNode, type RefObject } from "react";
import { Clock, FolderTree, GitGraph, Hash, List, ListTodo, Settings, Star, Trash2, type LucideIcon } from "lucide-react";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useSync } from "@/features/sync/hooks/useSync";
import { deriveSyncFailure } from "@/features/sync/utils/status";
import { MobileUpdateDialog } from "@/features/update/components/MobileUpdateDialog";
import { useUiStore } from "@/stores/ui.store";
import { useTranslation } from "@/i18n";
import { useMobileEditorView } from "../hooks/useMobileEditorView";
import { useMobileKeyboardInsets } from "../hooks/useMobileKeyboardInsets";
import type { SidebarTab } from "@/stores/ui.store";
import type { TranslationKey } from "@/i18n/messages";
import { MobileNavButton } from "./MobileButtons";
import { useTodoNavBadge } from "@/features/todo/hooks/useTodoAlertCounts";
import { MobileWorkspaceTopBar } from "./MobileWorkspaceTopBar";

const LazyConflictMergeDialog = lazy(() => import("@/features/sync/components/ConflictMergeDialog").then(({ ConflictMergeDialog }) => ({ default: ConflictMergeDialog })));
const LazyCommitDialog = lazy(() => import("@/features/commit/components/CommitDialog").then(({ CommitDialog }) => ({ default: CommitDialog })));
const LazyDiscardDialog = lazy(() => import("@/features/discard/components/DiscardDialog").then(({ DiscardDialog }) => ({ default: DiscardDialog })));
const LazyGitGraphPanel = lazy(() => import("@/features/git-graph/components/GitGraphPanel").then(({ GitGraphPanel }) => ({ default: GitGraphPanel })));

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
  const focusMode = useUiStore((state) => state.focusMode);
  const setFocusMode = useUiStore((state) => state.setFocusMode);
  const sync = useSync(repoPath);
  const { status, syncNow } = sync;
  const failure = deriveSyncFailure(syncNow.error, locale);
  const [commitOpen, setCommitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const { showEditor, backToList } = useMobileEditorView({
    currentNotePath,
    openEditorSignal,
    onBackToList,
    onFlush: () => editorRef.current?.flush(),
  });
  /** 顶栏标题：列表页是当前分组名；编辑器页是仓库名——笔记名就在下方工具栏里可编辑，重复没有意义 */
  const title = showEditor ? (repoDisplayName(repoPath) ?? t("app.notes")) : t(MOBILE_LIST_TITLES[sidebarTab]);
  useMobileKeyboardInsets();
  const focused = focusMode && showEditor;

  return (
    <div className="mobile-workspace-shell flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg-primary">
      <MobileWorkspaceTopBar
        focused={focused}
        repoPath={repoPath}
        showEditor={showEditor}
        title={title}
        sync={sync}
        onBack={backToList}
        onExitFocus={() => setFocusMode(false)}
        onOpenCommit={() => setCommitOpen(true)}
        onOpenDiscard={() => setDiscardOpen(true)}
      />
      <MobileUpdateDialog />
      <MobileContent
        showEditor={showEditor}
        sidebarTab={sidebarTab}
        setSidebarTab={setSidebarTab}
        onOpenGraph={() => setGraphOpen(true)}
        editor={editor}
        sidebar={sidebar}
        repoPath={repoPath}
      />
      <MobileWorkspaceDialogs
        repoPath={repoPath}
        commitOpen={commitOpen}
        discardOpen={discardOpen}
        graphOpen={graphOpen}
        onCloseCommit={() => setCommitOpen(false)}
        onCloseDiscard={() => setDiscardOpen(false)}
        onCloseGraph={() => setGraphOpen(false)}
      />
      <span className="sr-only" aria-live="polite">{failure ? `${failure.title} · ${failure.suggestion}` : status.conflicted ? t("sync.conflict") : status.hasUncommitted ? t("sync.unsaved") : null}</span>
    </div>
  );
}

/** 仓库目录末段作为展示名（`/a/b/notes` → `notes`） */
function repoDisplayName(repoPath: string | null): string | null {
  return repoPath?.split(/[\\/]/).filter(Boolean).pop() ?? null;
}

const MOBILE_LIST_TITLES: Record<SidebarTab, TranslationKey> = {
  tree: "app.notes",
  recent: "app.recent",
  favorites: "app.favorites",
  todo: "todo.title",
  tags: "wiki.tags",
  trash: "trash.title",
};

function MobileContent({ showEditor, sidebarTab, setSidebarTab, onOpenGraph, editor, sidebar, repoPath }: { showEditor: boolean; sidebarTab: SidebarTab; setSidebarTab: (tab: SidebarTab) => void; onOpenGraph: () => void; editor: ReactNode; sidebar: ReactNode; repoPath: string | null }) {
  return (
    <>
      <main className="min-h-0 flex-1 overflow-hidden">
        {showEditor ? (
          <div className="mobile-editor-pane h-full min-h-0">{editor}</div>
        ) : (
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <MobileListTabs active={sidebarTab} onChange={setSidebarTab} onOpenGraph={onOpenGraph} />
            <div className="mobile-list-content min-h-0 flex-1 overflow-hidden">{sidebar}</div>
          </div>
        )}
      </main>
      {showEditor ? null : (
        <MobileBottomNav
          repoPath={repoPath}
          notesActive={sidebarTab === "tree"}
          favoritesActive={sidebarTab === "favorites"}
          todoActive={sidebarTab === "todo"}
          onOpenNotes={() => setSidebarTab("tree")}
          onOpenTodo={() => setSidebarTab("todo")}
          onOpenFavorites={() => setSidebarTab("favorites")}
          onOpenSettings={() => useUiStore.getState().openSettings()}
        />
      )}
    </>
  );
}

/** 冲突面板的开关在全局 UI store 里：同步失败横幅与顶栏状态胶囊都要能拉起它。 */
function MobileWorkspaceDialogs({ repoPath, commitOpen, discardOpen, graphOpen, onCloseCommit, onCloseDiscard, onCloseGraph }: { repoPath: string | null; commitOpen: boolean; discardOpen: boolean; graphOpen: boolean; onCloseCommit: () => void; onCloseDiscard: () => void; onCloseGraph: () => void }) {
  const conflictOpen = useUiStore((state) => state.conflictDialogOpen);
  return (
    <>
      {conflictOpen ? (
        <Suspense fallback={null}>
          <LazyConflictMergeDialog repoPath={repoPath} open onClose={useUiStore.getState().closeConflictDialog} />
        </Suspense>
      ) : null}
      {commitOpen ? (
        <Suspense fallback={null}>
          <LazyCommitDialog repoPath={repoPath} onClose={onCloseCommit} />
        </Suspense>
      ) : null}
      {discardOpen ? (
        <Suspense fallback={null}>
          <LazyDiscardDialog repoPath={repoPath} onClose={onCloseDiscard} />
        </Suspense>
      ) : null}
      {graphOpen ? (
        <Suspense fallback={null}>
          <LazyGitGraphPanel repoPath={repoPath} open onClose={onCloseGraph} />
        </Suspense>
      ) : null}
    </>
  );
}

function MobileListTabs({ active, onChange, onOpenGraph }: { active: SidebarTab; onChange: (tab: SidebarTab) => void; onOpenGraph: () => void }) {
  const { t } = useTranslation();
  const tabs: { id: SidebarTab | "graph"; label: string; icon: LucideIcon }[] = [
    { id: "tree", label: t("tree.label"), icon: FolderTree },
    { id: "recent", label: t("app.recent"), icon: Clock },
    { id: "favorites", label: t("app.favorites"), icon: Star },
    { id: "todo", label: t("todo.title"), icon: ListTodo },
    { id: "tags", label: t("wiki.tags"), icon: Hash },
    { id: "trash", label: t("trash.title"), icon: Trash2 },
    { id: "graph", label: t("graph.title"), icon: GitGraph },
  ];
  return (
    <div className="mobile-list-tabs flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-bg-primary px-2 py-1.5" role="tablist" aria-label={t("app.workspaceNavigation")}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} className={`mobile-list-tab ${active === id ? "is-active" : ""}`} onClick={() => (id === "graph" ? onOpenGraph() : onChange(id))}>
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function MobileBottomNav({ repoPath, notesActive, todoActive, favoritesActive, onOpenNotes, onOpenTodo, onOpenFavorites, onOpenSettings }: { repoPath: string | null; notesActive: boolean; todoActive: boolean; favoritesActive: boolean; onOpenNotes: () => void; onOpenTodo: () => void; onOpenFavorites: () => void; onOpenSettings: () => void }) {
  const { t } = useTranslation();
  // 待办入口常驻显示逾期 / 今日到期的数量角标
  const todoBadge = useTodoNavBadge(repoPath);
  return (
    <nav className="mobile-bottom-nav flex min-h-16 shrink-0 items-stretch justify-around border-t border-border bg-bg-secondary pb-[var(--safe-bottom)]" aria-label={t("app.workspaceNavigation")}>
      <MobileNavButton active={notesActive} label={t("app.notes")} icon={List} onClick={onOpenNotes} />
      <MobileNavButton active={todoActive} label={t("todo.title")} icon={ListTodo} onClick={onOpenTodo} badge={todoBadge} />
      <MobileNavButton active={favoritesActive} label={t("app.favorites")} icon={Star} onClick={onOpenFavorites} />
      <MobileNavButton label={t("settings.title")} icon={Settings} onClick={onOpenSettings} />
    </nav>
  );
}
