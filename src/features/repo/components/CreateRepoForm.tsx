import { useState } from "react";
import { messageOf, repoApi } from "@/api";
import { Button } from "@/components/atoms/Button";

interface CreateRepoFormProps {
  onBound: (repoPath: string) => void;
}

/** 在 GitHub 新建笔记仓库并绑定（P0-1） */
export function CreateRepoForm({ onBound }: CreateRepoFormProps) {
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
      <h2 className="mb-2 text-lg font-semibold">新建笔记仓库</h2>
      <p className="mb-4 text-sm text-text-secondary">在 GitHub 上创建仓库并自动绑定，笔记会以 Markdown 文件存入其中。</p>
      <input autoFocus className="mb-3 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="仓库名（如 my-notes）" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      <label className="mb-4 flex items-center gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        私有仓库（推荐）
      </label>
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={busy || !name.trim()}>{busy ? "创建中…" : "创建并绑定"}</Button>
      </div>
    </div>
  );
}
