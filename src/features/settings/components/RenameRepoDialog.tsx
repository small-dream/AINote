import { useState } from "react";
import { messageOf } from "@/api";
import type { RepoInfo } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";

interface RenameRepoDialogProps {
  repo: RepoInfo | null;
  onClose: () => void;
  onSubmit: (id: string, name: string) => Promise<void>;
}

const INPUT_CLASS =
  "mb-4 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent";

/** 设置页「重命名仓库」：修改展示名。用 key 重挂载以重置输入，见 RepoManager。 */
export function RenameRepoDialog({ repo, onClose, onSubmit }: RenameRepoDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(repo?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!repo) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(repo.id, trimmed);
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={repo !== null} title={t("repo.renameTitle")} onClose={onClose}>
      <input autoFocus value={name} placeholder={t("repo.name")} className={INPUT_CLASS}
        onChange={(e) => { setName(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={submit} disabled={busy || !name.trim()}>{busy ? t("common.saving") : t("common.save")}</Button>
      </div>
    </Modal>
  );
}
