import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";

export interface PendingDelete { path: string; name: string; isFolder: boolean; }

export function DeleteConfirmDialog({ pending, busy, onClose, onConfirm }: { pending: PendingDelete | null; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!pending) return null;
  return <Modal open title={pending.isFolder ? "删除目录" : "删除笔记"} onClose={busy ? () => undefined : onClose}>
    <p className="mb-2 text-sm text-text-primary">确定删除“{pending.name}”吗？</p>
    <p className="mb-5 text-xs leading-5 text-text-secondary">{pending.isFolder ? "目录中的所有笔记都会被永久删除。" : "此操作不可恢复。"}</p>
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={busy}>取消</Button>
      <Button variant="primary" className="bg-danger hover:brightness-95" onClick={onConfirm} disabled={busy}>{busy ? "删除中…" : "确认删除"}</Button>
    </div>
  </Modal>;
}
