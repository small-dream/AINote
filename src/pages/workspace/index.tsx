import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { authApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { FileTree } from "@/features/file-tree/components/FileTree";
import { MoveNoteDialog } from "@/features/note/components/MoveNoteDialog";
import { NoteEditor, type NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { NoteList } from "@/features/note/components/NoteList";
import { SyncBar } from "@/features/sync/components/SyncBar";
import { useStartupSync } from "@/features/sync/hooks/useStartupSync";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useSessionStore } from "@/stores/session.store";

/** 工作区：同步条 + 目录树 | 笔记列表 | 编辑器（三栏） */
export function WorkspacePage() {
  const navigate = useNavigate();
  const { ready, repoPath } = useWorkspaceGate();
  const startupSyncing = useStartupSync(repoPath);
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const openNote = useSessionStore((s) => s.openNote);
  const reset = useSessionStore((s) => s.reset);
  const editorRef = useRef<NoteEditorHandle>(null);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  function handleSelect(path: string) {
    editorRef.current?.flush();
    openNote(path);
  }

  async function handleLogout() {
    setLogoutBusy(true);
    try {
      await authApi.logout();
      reset();
      navigate("/setup", { replace: true });
    } finally {
      setLogoutBusy(false);
    }
  }

  if (!ready) return <LoadingScreen />;

  return (
    <div className="flex h-screen flex-col">
      <SyncBar repoPath={repoPath} startupSyncing={startupSyncing} />
      <div className="flex min-h-0 flex-1">
        <WorkspaceSidebar repoPath={repoPath} onSelect={handleSelect} onLogout={() => void handleLogout()} logoutBusy={logoutBusy} />
        <section className="w-72 border-r border-bg-secondary"><NoteList repoPath={repoPath} onSelect={handleSelect} /></section>
        <main className="min-w-0 flex-1"><NoteEditor ref={editorRef} repoPath={repoPath} notePath={currentNotePath} onMove={setMoveTarget} /></main>
      </div>
      <MoveNoteDialog key={moveTarget ?? "none"} path={moveTarget} onClose={() => setMoveTarget(null)} onMoved={(to) => { openNote(to); setMoveTarget(null); }} />
    </div>
  );
}

/** 启动守卫：未绑定仓库跳转 /setup，并同步会话中的 repoPath */
function useWorkspaceGate() {
  const navigate = useNavigate();
  const repoPath = useSessionStore((s) => s.repoPath);
  const setRepoPath = useSessionStore((s) => s.setRepoPath);
  const { data, isLoading } = useAuthStatusQuery();

  useEffect(() => {
    if (isLoading) return;
    if (!data?.repoPath) navigate("/setup", { replace: true });
    else if (!repoPath) setRepoPath(data.repoPath);
  }, [isLoading, data, navigate, repoPath, setRepoPath]);

  return { ready: !isLoading && repoPath !== null, repoPath };
}

interface WorkspaceSidebarProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onLogout: () => void;
  logoutBusy: boolean;
}

function WorkspaceSidebar({ repoPath, onSelect, onLogout, logoutBusy }: WorkspaceSidebarProps) {
  return (
    <aside className="flex w-64 flex-col border-r border-bg-secondary bg-bg-secondary">
      <div className="flex items-center justify-between border-b border-bg-secondary px-4 py-2">
        <span className="truncate text-sm font-medium">我的笔记</span>
        <Button variant="ghost" onClick={onLogout} disabled={logoutBusy}>
          登出
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <FileTree repoPath={repoPath} onSelect={onSelect} />
      </div>
    </aside>
  );
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-text-secondary">
      加载中…
    </div>
  );
}
