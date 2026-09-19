import { useState } from "react";
import { messageOf, repoApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";
import { flushPendingDrafts } from "@/features/note/utils/draftRegistry";
import { useAuthStatusQuery } from "@/queries/auth.queries";

interface CreateRepoFormProps {
  onBound: (repoPath: string) => void;
  /** 需要目标平台账号时交回上层，由上层引导登录 */
  onNeedLogin?: ((input: { providerId: string; repoUrl?: string }) => void) | undefined;
}

/** 在平台新建笔记仓库并绑定（P0-1）；当前只有 GitHub 提供建仓接口 */
export function CreateRepoForm({ onBound, onNeedLogin }: CreateRepoFormProps) {
  const { t } = useTranslation();
  const { data } = useAuthStatusQuery();
  const github = data?.providers.find((provider) => provider.id === PROVIDER_ID);
  const ready = github?.hasToken === true;
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || !ready) return;
    setBusy(true);
    setError(null);
    try {
      // 建仓成功后端会切换活动仓库，必须先落盘当前仓库的草稿。
      await flushPendingDrafts();
      onBound((await repoApi.create(PROVIDER_ID, trimmed, isPrivate)).repoPath);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("repo.createTitle")}</h2>
      <p className="mb-4 text-sm text-text-secondary">{t("repo.createDescription")}</p>
      {!ready && (
        <MissingProviderHint
          displayName={github?.displayName ?? "GitHub"}
          onNeedLogin={onNeedLogin}
        />
      )}
      <input autoFocus className="mb-3 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder={t("repo.namePlaceholder")} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(); }} />
      <label className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        {t("repo.private")}
      </label>
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !ready || !name.trim()}>{busy ? t("common.creating") : t("repo.createAndBind")}</Button>
      </div>
    </div>
  );
}

/** 应用内建仓当前由 GitHub 独占（见 domain::hosting::supports_create）。 */
const PROVIDER_ID = "github";

interface MissingProviderHintProps {
  displayName: string;
  onNeedLogin?: ((input: { providerId: string; repoUrl?: string }) => void) | undefined;
}

/** 建仓需要先登录目标平台：给出就地登录入口，没有入口时退化为一句提示 */
function MissingProviderHint({ displayName, onNeedLogin }: MissingProviderHintProps) {
  const { t } = useTranslation();
  return (
    <>
      <p className="mb-4 text-xs text-text-tertiary">
        {t("repo.createNeedsProvider", { provider: displayName })}
      </p>
      {onNeedLogin && (
        <Button
          variant="ghost"
          className="mb-4 inline-flex items-center border border-border text-xs"
          onClick={() => onNeedLogin({ providerId: PROVIDER_ID })}
        >
          {t("repo.bindLoginRequired", { provider: displayName })}
        </Button>
      )}
    </>
  );
}
