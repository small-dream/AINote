import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/atoms/Button";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RepoSetup } from "@/features/repo/components/RepoSetup";
import { useAuthStatusQuery } from "@/queries/auth.queries";
import { useSessionStore } from "@/stores/session.store";
import { useTranslation } from "@/i18n";
import type { AuthStatusDto } from "@/api/types";

/** 首次启动引导：登录 → 绑定/创建笔记仓库 → 进入工作区（P0-1） */
export function SetupPage() {
  const {
    data,
    isLoading,
    refetch,
    handleAuthed,
    handleBound,
    loginProviderId,
    pendingUrl,
    beginLogin,
    cancelLogin,
  } = useSetupGate();

  if (isLoading) return <LoadingScreen />;
  if (!data) return <LoadFailed onRetry={() => void refetch()} />;

  return (
    <div data-tauri-drag-region className="flex h-screen items-center justify-center bg-bg-secondary">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-8 shadow">
        {loginProviderId ? (
          <LoginStep providerId={loginProviderId} onBack={cancelLogin} onSuccess={handleAuthed} />
        ) : data.hasToken ? (
          <RepoSetup onBound={handleBound} onNeedLogin={beginLogin} initialUrl={pendingUrl || undefined} />
        ) : (
          <LoginForm onSuccess={handleAuthed} />
        )}
      </div>
    </div>
  );
}

interface LoginStepProps {
  providerId: string;
  onBack: () => void;
  onSuccess: (result: { login: string; providerId: string }) => void;
}

/** 绑定过程中缺凭证时的补登录：只登录目标平台，成功后回到绑定表单 */
function LoginStep({ providerId, onBack, onSuccess }: LoginStepProps) {
  const { t } = useTranslation();
  return (
    <div>
      <LoginForm fixedProviderId={providerId} onSuccess={onSuccess} />
      <div className="mt-4 flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          {t("common.back")}
        </Button>
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
  /** 正在补登录的平台（null 表示当前不在登录步骤） */
  const [loginProviderId, setLoginProviderId] = useState<string | null>(null);
  /** 登录返回后要恢复的仓库地址：跨登录步骤保留，避免用户重填 */
  const [pendingUrl, setPendingUrl] = useState("");

  useEffect(() => {
    if (data?.repoPath) {
      setRepoPath(data.repoPath);
      navigate("/workspace", { replace: true });
    }
  }, [data, navigate, setRepoPath]);

  /** 乐观更新登录状态：随后的 refetch 失败也要让用户进入下一步（既有行为） */
  const handleAuthed = ({ login, providerId }: { login: string; providerId: string }) => {
    queryClient.setQueryData<AuthStatusDto>(["auth-status"], (prev) => ({
      hasToken: true,
      repoPath: prev?.repoPath ?? null,
      providers: (prev?.providers ?? []).map((provider) =>
        provider.id === providerId ? { ...provider, hasToken: true, login } : provider
      ),
    }));
    setLoginProviderId(null);
    void refetch();
  };

  /** 绑定/建仓缺少目标平台凭证：转去登录该平台，保留已填地址 */
  const beginLogin = ({ providerId, repoUrl }: { providerId: string; repoUrl?: string }) => {
    if (repoUrl) setPendingUrl(repoUrl);
    setLoginProviderId(providerId);
  };

  const cancelLogin = () => setLoginProviderId(null);

  const handleBound = (repoPath: string) => {
    setRepoPath(repoPath);
    // 必须整份合并：局部对象会让 providers 丢失，设置页账户区将无平台可展示
    queryClient.setQueryData<AuthStatusDto>(["auth-status"], (prev) => ({
      hasToken: prev?.hasToken ?? true,
      repoPath,
      providers: prev?.providers ?? [],
    }));
    navigate("/workspace", { replace: true });
  };

  return {
    data,
    isLoading,
    refetch,
    handleAuthed,
    handleBound,
    loginProviderId,
    pendingUrl,
    beginLogin,
    cancelLogin,
  };
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div data-tauri-drag-region className="flex h-screen items-center justify-center text-sm text-text-secondary">
      {t("common.loading")}
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div data-tauri-drag-region className="flex h-screen flex-col items-center justify-center gap-3 text-sm text-danger">
      <span>{t("app.authLoadFailed")}</span>
      <Button variant="ghost" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
