import { useState } from "react";
import { messageOf } from "@/api";
import type { RepoInfo } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";

interface RemoveRepoDialogProps {
  repo: RepoInfo | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

/** 设置页「移除仓库」：仅取消绑定，不删除本地数据 */
export function RemoveRepoDialog({ repo, onClose, onConfirm }: RemoveRepoDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!repo) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(repo.id);
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={repo !== null} title="移除仓库" onClose={onClose}>
      <p className="mb-2 text-sm">
        确定移除「{repo?.name}」？仅取消绑定，本地笔记数据不会被删除。
      </p>
      {repo?.path && (
        <p className="mb-4 truncate text-xs text-text-tertiary" title={repo.path}>
          {repo.path}
        </p>
      )}
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={confirm} disabled={busy || !repo}>
          {busy ? "移除中…" : "移除"}
        </Button>
      </div>
    </Modal>
  );
}
