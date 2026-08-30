import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { normalizeNotePath } from "../utils/path";

interface NewNoteDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (path: string) => void;
}

/** 新建笔记：输入路径（可含目录，如 daily/笔记） */
export function NewNoteDialog({ open, onClose, onCreate }: NewNoteDialogProps) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit() {
    const normalized = normalizeNotePath(path);
    if (!normalized) {
      setError("请输入笔记路径");
      return;
    }
    onCreate(normalized);
    setPath("");
    setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">新建笔记</h2>
        <input autoFocus className="mb-2 w-full rounded-md border border-bg-secondary bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent" placeholder="如：daily/我的笔记（自动补 .md）" value={path} onChange={(e) => { setPath(e.target.value); setError(null); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        {error && <p className="mb-2 text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={submit}>创建</Button>
        </div>
      </div>
    </div>
  );
}
