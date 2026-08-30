import { Button } from "@/components/atoms/Button";

interface ConflictDialogProps {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onResolve: (useLocal: boolean) => void;
}

/** Pull 冲突解决（MVP：保留本地 / 使用远端 二选一，见 PRD 冲突策略） */
export function ConflictDialog({ open, pending, onClose, onResolve }: ConflictDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-bg-primary p-6 shadow-lg">
        <h2 className="mb-2 text-lg font-semibold">同步发生冲突</h2>
        <p className="mb-6 text-sm text-text-secondary">
          本地与远端对同一内容都有修改，请选择保留哪一侧。图形化合并将在后续版本提供。
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            稍后处理
          </Button>
          <Button variant="ghost" onClick={() => onResolve(false)} disabled={pending}>
            使用远端
          </Button>
          <Button variant="primary" onClick={() => onResolve(true)} disabled={pending}>
            {pending ? "处理中…" : "保留本地"}
          </Button>
        </div>
      </div>
    </div>
  );
}
