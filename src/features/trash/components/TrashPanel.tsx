import { useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { useTranslation } from "@/i18n";
import { formatDate } from "@/features/history/utils/format";
import type { TrashItem } from "@/api/types";
import {
  useTrashDeleteMutation,
  useTrashEmptyMutation,
  useTrashListQuery,
  useTrashRestoreMutation,
} from "@/queries/trash.queries";

interface TrashPanelProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 侧边栏回收站：软删除笔记的恢复 / 彻底删除 / 清空（P2） */
export function TrashPanel({ repoPath, onSelect }: TrashPanelProps) {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = useTrashListQuery(repoPath);
  const restore = useTrashRestoreMutation(onSelect);
  const remove = useTrashDeleteMutation();
  const empty = useTrashEmptyMutation();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  if (isLoading) {
    return <div className="p-4 text-sm text-text-secondary">{t("common.loading")}</div>;
  }
  const busy = restore.isPending || remove.isPending || empty.isPending;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("trash.title")}</span>
        {items.length > 0 && (
          <Button variant="ghost" className="px-2 py-0.5 text-[11px]" onClick={() => setConfirmEmpty(true)} disabled={busy}>
            {t("trash.empty")}
          </Button>
        )}
      </header>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label={t("trash.title")}>
          {items.map((item) => (
            <TrashRow
              key={item.id}
              item={item}
              busy={busy}
              onRestore={() => restore.mutate(item.id)}
              onDelete={() => remove.mutate(item.id)}
            />
          ))}
        </nav>
      )}
      <EmptyTrashDialog open={confirmEmpty} busy={empty.isPending} onClose={() => setConfirmEmpty(false)} onConfirm={() => empty.mutate(undefined, { onSuccess: () => setConfirmEmpty(false) })} />
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
      <Trash2 size={26} className="text-text-tertiary" />
      <p className="text-sm text-text-secondary">{t("trash.noItems")}</p>
    </div>
  );
}

interface TrashRowProps {
  item: TrashItem;
  busy: boolean;
  onRestore: () => void;
  onDelete: () => void;
}

function TrashRow({ item, busy, onRestore, onDelete }: TrashRowProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-1 flex items-center gap-1.5 rounded-md px-2 py-2 hover:bg-bg-secondary">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{item.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
          {item.path} · {formatDate(item.deletedAt)}
        </p>
      </div>
      <button type="button" aria-label={t("trash.restore")} title={t("trash.restore")} onClick={onRestore} disabled={busy} className="grid h-7 w-7 shrink-0 place-items-center rounded text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent disabled:opacity-50">
        <RotateCcw size={15} />
      </button>
      <button type="button" aria-label={t("trash.deletePermanent")} title={t("trash.deletePermanent")} onClick={onDelete} disabled={busy} className="grid h-7 w-7 shrink-0 place-items-center rounded text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-danger disabled:opacity-50">
        <X size={15} />
      </button>
    </div>
  );
}

function EmptyTrashDialog({ open, busy, onClose, onConfirm }: { open: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t("trash.empty")} onClose={busy ? () => undefined : onClose}>
      <p className="mb-5 text-sm leading-5 text-text-secondary">{t("trash.emptyConfirm")}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Button variant="primary" className="bg-danger hover:brightness-95" onClick={onConfirm} disabled={busy}>{busy ? t("common.deleting") : t("trash.confirmEmpty")}</Button>
      </div>
    </Modal>
  );
}
