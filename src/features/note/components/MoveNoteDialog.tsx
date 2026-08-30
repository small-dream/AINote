import { useState } from "react";
import { messageOf } from "@/api";
import { Button } from "@/components/atoms/Button";
import { useMoveNoteMutation } from "@/queries/note.queries";
import { normalizeNotePath } from "../utils/path";

interface MoveNoteDialogProps {
  path: string | null;
  onClose: () => void;
  onMoved: (to: string) => void;
}

/** 重命名 / 移动笔记：输入目标路径。父组件以 key={path} 重建以重置草稿。 */
export function MoveNoteDialog({ path, onClose, onMoved }: MoveNoteDialogProps) {
  const move = useMoveNoteMutation();
  const [to, setTo] = useState(path ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!path) return null;

  function submit() {
    if (!path) return;
    const normalized = normalizeNotePath(to);
    if (!normalized) {
      setError("请输入目标路径");
      return;
    }
    if (normalized === path) {
      onClose();
      return;
    }
    move.mutate({ from: path, to: normalized }, { onSuccess: () => { onMoved(normalized); onClose(); } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">重命名 / 移动</h2>
        <p className="mb-3 text-xs text-text-secondary">当前：{path}</p>
        <input autoFocus className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="目标路径，如 daily/新名字.md" value={to} onChange={(e) => { setTo(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        {move.isError && <p className="mb-2 text-xs text-danger">{messageOf(move.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={move.isPending}>取消</Button>
          <Button variant="primary" onClick={submit} disabled={move.isPending}>{move.isPending ? "移动中…" : "确认"}</Button>
        </div>
      </div>
    </div>
  );
}
