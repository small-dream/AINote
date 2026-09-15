import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { TaskListDto } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";

interface ListBarProps {
  lists: TaskListDto[];
  activeListId: string | null;
  busy: boolean;
  onSelect: (listId: string) => void;
  onCreate: (name: string) => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
}

/** 清单 chips 行：切换 / 新建 / 重命名 / 删除（删除二次确认）。 */
export function ListBar({ lists, activeListId, busy, onSelect, onCreate, onRename, onDelete }: ListBarProps) {
  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2 py-1.5">
      {lists.map((list) => (
        <button
          key={list.id}
          type="button"
          onClick={() => onSelect(list.id)}
          aria-current={list.id === activeListId ? "page" : undefined}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors ${list.id === activeListId ? "bg-accent text-white" : "bg-bg-tertiary text-text-secondary hover:text-text-primary"}`}
        >
          {list.name}
        </button>
      ))}
      <ListActions activeList={activeList} busy={busy} onCreate={onCreate} onRename={onRename} onDelete={onDelete} />
    </div>
  );
}

interface ListActionsProps {
  activeList: TaskListDto | null;
  busy: boolean;
  onCreate: (name: string) => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
}

const ICON_CLASS = "grid h-6 w-6 shrink-0 place-items-center rounded-full text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50";

function ListActions({ activeList, busy, onCreate, onRename, onDelete }: ListActionsProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<"creating" | "renaming" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (editing) {
    return (
      <ListNameInput
        initial={editing === "renaming" ? (activeList?.name ?? "") : ""}
        onSubmit={(name) => {
          if (editing === "renaming" && activeList) onRename(activeList.id, name);
          if (editing === "creating") onCreate(name);
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <>
      <Tooltip content={t("todo.newList")}>
        <button type="button" aria-label={t("todo.newList")} onClick={() => setEditing("creating")} disabled={busy} className={ICON_CLASS}>
          <Plus size={13} aria-hidden="true" />
        </button>
      </Tooltip>
      {activeList ? (
        <>
          <Tooltip content={t("todo.renameList")}>
            <button type="button" aria-label={t("todo.renameList")} onClick={() => setEditing("renaming")} disabled={busy} className={ICON_CLASS}>
              <Pencil size={12} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content={t("todo.deleteList")}>
            <button type="button" aria-label={t("todo.deleteList")} onClick={() => setConfirmDelete(true)} disabled={busy} className={`${ICON_CLASS} hover:text-danger`}>
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </Tooltip>
          <DeleteListDialog
            open={confirmDelete}
            listName={activeList.name}
            busy={busy}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => { onDelete(activeList.id); setConfirmDelete(false); }}
          />
        </>
      ) : null}
    </>
  );
}

function ListNameInput({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const pushToast = useToastStore((state) => state.push);
  const [value, setValue] = useState(initial);

  function submit(): void {
    const name = value.trim();
    if (!name) {
      pushToast(t("todo.listNameRequired"), "error");
      return;
    }
    onSubmit(name);
  }

  return (
    <input
      autoFocus
      className="w-28 shrink-0 rounded-full border border-accent bg-bg-primary px-2.5 py-1 text-xs text-text-primary outline-none"
      placeholder={t("todo.listNamePlaceholder")}
      aria-label={t("todo.listNamePlaceholder")}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") submit();
        if (event.key === "Escape") onCancel();
      }}
      onBlur={onCancel}
    />
  );
}

function DeleteListDialog({ open, listName, busy, onClose, onConfirm }: { open: boolean; listName: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open={open} title={t("todo.deleteList")} onClose={busy ? () => undefined : onClose}>
      <p className="mb-5 text-sm leading-5 text-text-secondary">{t("todo.deleteListConfirm", { name: listName })}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
        <Button variant="primary" className="bg-danger hover:brightness-95" onClick={onConfirm} disabled={busy}>
          {busy ? t("common.deleting") : t("common.delete")}
        </Button>
      </div>
    </Modal>
  );
}
