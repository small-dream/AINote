import { useState } from "react";
import { messageOf, repoApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface BindRepoFormProps {
  onBound: (repoPath: string) => void;
}

/** 绑定已有 GitHub 仓库（P0-1） */
export function BindRepoForm({ onBound }: BindRepoFormProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      onBound((await repoApi.bind(trimmed)).repoPath);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{t("repo.bindTitle")}</h2>
      <p className="mb-4 text-sm text-text-secondary">{t("repo.bindDescription")}</p>
      <input autoFocus className="mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="https://github.com/user/my-notes.git" value={url} onChange={(e) => { setUrl(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !url.trim()}>{busy ? t("repo.binding") : t("repo.bind")}</Button>
      </div>
    </div>
  );
}
