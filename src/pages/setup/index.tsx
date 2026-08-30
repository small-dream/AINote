import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/atoms/Button";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RepoSetup } from "@/features/repo/components/RepoSetup";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useSessionStore } from "@/stores/session.store";

/** 首次启动引导：登录 → 绑定/创建笔记仓库 → 进入工作区（P0-1） */
export function SetupPage() {
  const { data, isLoading, refetch, handleAuthed, handleBound } = useSetupGate();

  if (isLoading) return <LoadingScreen />;
  if (!data) return <LoadFailed onRetry={() => void refetch()} />;

  return (
    <div className="flex h-screen items-center justify-center bg-bg-secondary">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-8 shadow">
        {data.hasToken ? <RepoSetup onBound={handleBound} /> : <LoginForm onSuccess={handleAuthed} />}
      </div>
    </div>
  );
}

/** 认证状态守卫 + 登录/绑定后的缓存更新与导航 */
function useSetupGate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setRepoPath = useSessionStore((s) => s.setRepoPath);
  const { data, isLoading, refetch } = useAuthStatusQuery();

  useEffect(() => {
    if (data?.repoPath) {
      setRepoPath(data.repoPath);
      navigate("/workspace", { replace: true });
    }
  }, [data, navigate, setRepoPath]);

  const handleAuthed = () => {
    queryClient.setQueryData(["auth-status"], { hasToken: true, repoPath: null });
    void queryClient.invalidateQueries({ queryKey: ["auth-status"] });
  };

  const handleBound = (repoPath: string) => {
    setRepoPath(repoPath);
    queryClient.setQueryData(["auth-status"], { hasToken: true, repoPath });
    navigate("/workspace", { replace: true });
  };

  return { data, isLoading, refetch, handleAuthed, handleBound };
}

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-text-secondary">
      加载中…
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-danger">
      <span>加载认证状态失败</span>
      <Button variant="ghost" onClick={onRetry}>
        重试
      </Button>
    </div>
  );
}
