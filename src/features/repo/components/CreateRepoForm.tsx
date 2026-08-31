import { useState } from "react";
import { messageOf, repoApi } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useTranslation } from "@/i18n";

interface CreateRepoFormProps {
  onBound: (repoPath: string) => void;
}

/** 在 GitHub 新建笔记仓库并绑定（P0-1） */
export function CreateRepoForm({ onBound }: CreateRepoFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      onBound((await repoApi.create(trimmed, isPrivate)).repoPath);
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
      <input autoFocus className="mb-3 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder={t("repo.namePlaceholder")} value={name} onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      <label className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        {t("repo.private")}
      </label>
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>{busy ? t("common.creating") : t("repo.createAndBind")}</Button>
      </div>
    </div>
  );
}
