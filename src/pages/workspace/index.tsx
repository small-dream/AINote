import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { NoteEditorHandle } from "@/features/note/components/NoteEditor";
import { useStartupSync } from "@/features/sync/hooks/useStartupSync";
import { useTaskReminders } from "@/features/todo/hooks/useTaskReminders";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { useVaultUnlockStore } from "@/stores/vault-unlock.store";
import { WorkspaceShellSwitcher } from "@/app/ShellSwitcher";
import { useWorkspaceActions } from "./useWorkspaceActions";
import { useTranslation } from "@/i18n";

/** 工作区：启动守卫 + 新建/移动编排，桌面/移动壳选择委托给组装层 WorkspaceShellSwitcher */
export function WorkspacePage() {
  const { ready, repoPath } = useWorkspaceGate();
  const startupSyncing = useStartupSync(repoPath);
  // 提醒调度挂在工作区根部：桌面/移动双壳都会经过这里，且只挂一次
  useTaskReminders(ready ? repoPath : null);
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const openNote = useSessionStore((s) => s.openNote);
  const recordRecentNote = useUiStore((state) => state.recordRecentNote);
  const editorRef = useRef<NoteEditorHandle>(null);
  const actions = useWorkspaceActions(repoPath, handleSelect);

  async function handleSelect(path: string) {
    await editorRef.current?.flush();
    // 用户主动打开笔记：允许加密笔记的解锁遮罩自动弹一次系统认证。
    useVaultUnlockStore.getState().arm();
    openNote(path);
    if (repoPath) recordRecentNote(repoPath, path);
  }

  if (!ready) return <LoadingScreen />;

  return (
    <WorkspaceShellSwitcher
      repoPath={repoPath}
      startupSyncing={startupSyncing}
      currentNotePath={currentNotePath}
      editorRef={editorRef}
      actions={actions}
      onSelect={handleSelect}
      onMoved={handleSelect}
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
    <div data-tauri-drag-region className="flex h-screen items-center justify-center text-sm text-text-secondary">
      {t("common.loading")}
    </div>
  );
}
