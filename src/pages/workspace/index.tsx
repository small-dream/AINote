import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useStartupSync } from "@/features/sync/hooks/useStartupSync";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useSessionStore } from "@/stores/session.store";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { useWorkspaceActions } from "./useWorkspaceActions";
import { useTranslation } from "@/i18n";

/** 工作区：启动守卫 + 新建/移动编排，三栏渲染委托给 WorkspaceLayout */
export function WorkspacePage() {
  const { ready, repoPath } = useWorkspaceGate();
  const startupSyncing = useStartupSync(repoPath);
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const openNote = useSessionStore((s) => s.openNote);
  const editorRef = useRef<NoteEditorHandle>(null);
  const actions = useWorkspaceActions(repoPath, handleSelect);

  async function handleSelect(path: string) {
    await editorRef.current?.flush();
    openNote(path);
  }

  if (!ready) return <LoadingScreen />;

  return (
    <WorkspaceLayout
      repoPath={repoPath}
      startupSyncing={startupSyncing}
      currentNotePath={currentNotePath}
      editorRef={editorRef}
      actions={actions}
      onSelect={handleSelect}
      onMoved={openNote}
    />
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

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex h-screen items-center justify-center text-sm text-text-secondary">
      {t("common.loading")}
    </div>
  );
}
