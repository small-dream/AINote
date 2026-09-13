import { useState } from "react";
import { loginProviderOf, messageOf, repoApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useAuthStatusQuery } from "@/queries/auth.queries";

interface BindRepoFormProps {
  onBound: (repoPath: string) => void;
  /** 缺少目标平台凭证时把「平台 + 已填地址」交回上层，由上层引导登录 */
  onNeedLogin?: ((input: { providerId: string; repoUrl?: string }) => void) | undefined;
  /** 登录返回后恢复上次填写的地址 */
  initialUrl?: string | undefined;
}

/** 绑定已有仓库（P0-1）：平台由仓库地址自动识别，凭证取对应平台 */
export function BindRepoForm({ onBound, onNeedLogin, initialUrl }: BindRepoFormProps) {
  const { t } = useTranslation();
  const { data } = useAuthStatusQuery();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loginProviderId, setLoginProviderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const providerName =
    data?.providers.find((provider) => provider.id === loginProviderId)?.displayName ??
    loginProviderId ??
    "";

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      // 绑定成功后端会切换活动仓库，必须先落盘当前仓库的草稿。
      await flushPendingDrafts();
      onBound((await repoApi.bind(trimmed)).repoPath);
    } catch (err) {
      setError(messageOf(err));
      setLoginProviderId(loginProviderOf(err));
    } finally {
      setBusy(false);
    }
  }

  function onUrlChange(value: string) {
    setUrl(value);
    setError(null);
    setLoginProviderId(null);
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("repo.bindTitle")}</h2>
      <p className="mb-4 text-sm text-text-secondary">{t("repo.bindDescription")}</p>
      <input autoFocus className="mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="https://github.com/user/my-notes.git" value={url} onChange={(e) => onUrlChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      {loginProviderId &&
        (onNeedLogin ? (
          <Button
            variant="ghost"
            className="mb-3 inline-flex items-center border border-border text-xs"
            onClick={() => onNeedLogin({ providerId: loginProviderId, repoUrl: url.trim() })}
          >
            {t("repo.bindLoginRequired", { provider: providerName })}
          </Button>
        ) : (
          <p className="mb-3 text-xs text-text-tertiary">
            {t("repo.loginHint", { provider: providerName })}
          </p>
        ))}
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !url.trim()}>{busy ? t("repo.binding") : t("repo.bind")}</Button>
      </div>
    </div>
  );
}
