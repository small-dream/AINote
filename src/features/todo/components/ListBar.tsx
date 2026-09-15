import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ListTodo, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import type { TaskListDto } from "@/api/types";
import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useAnchoredLayer } from "@/hooks/useAnchoredLayer";
import { useTranslation } from "@/i18n";
import { useToastStore } from "@/stores/toast.store";

interface ListBarProps {
  lists: TaskListDto[];
  /** 每个清单的未完成任务数 */
  counts: Record<string, number>;
  activeListId: string | null;
  busy: boolean;
  onSelect: (listId: string) => void;
  onCreate: (name: string) => void;
  onRename: (listId: string, name: string) => void;
  onDelete: (listId: string) => void;
}

const MENU_CLASS = "fixed z-50 rounded-xl border border-border bg-bg-primary p-1 shadow-xl";
const ACTION_CLASS = "grid h-6 w-6 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-50";
const MENU_ITEM_CLASS = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors";

/** 清单选择器：当前清单下拉切换 + 新建 / 重命名 / 删除（删除二次确认）。 */
export function ListBar({ lists, counts, activeListId, busy, onSelect, onCreate, onRename, onDelete }: ListBarProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<"creating" | "renaming" | null>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const { menuRef: listMenuRef, position: listMenuPos } = useAnchoredLayer({ triggerRef: selectorRef, open: menuOpen, close: () => setMenuOpen(false), width: 200, align: "start" });
  const activeList = lists.find((list) => list.id === activeListId) ?? null;

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1.5">
      {editing ? (
        <ListNameInput
          initial={editing === "renaming" ? (activeList?.name ?? "") : ""}
          onSubmit={(name) => {
            if (editing === "renaming" && activeList) onRename(activeList.id, name);
            if (editing === "creating") onCreate(name);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div ref={selectorRef} className="min-w-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex h-7 max-w-44 items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-bg-tertiary"
          >
            <ListTodo size={13} aria-hidden="true" className="shrink-0 text-text-tertiary" />
            <span className="truncate">{activeList?.name ?? t("todo.title")}</span>
            <ChevronDown size={12} aria-hidden="true" className="shrink-0 text-text-tertiary" />
          </button>
        </div>
      )}
      <div className="flex-1" />
      <Tooltip content={t("todo.newList")} placement="bottom" align="end">
        <button type="button" aria-label={t("todo.newList")} onClick={() => setEditing("creating")} disabled={busy} className={ACTION_CLASS}>
          <Plus size={14} aria-hidden="true" />
        </button>
      </Tooltip>
      {activeList ? (
        <ListActions activeList={activeList} busy={busy} onRename={() => setEditing("renaming")} onDelete={onDelete} />
      ) : null}
      {menuOpen ? (
        <ListMenu lists={lists} counts={counts} activeListId={activeListId} menuRef={listMenuRef} position={listMenuPos} onSelect={(listId) => { onSelect(listId); setMenuOpen(false); }} />
      ) : null}
    </div>
  );
}

interface ListActionsProps {
  activeList: TaskListDto;
  busy: boolean;
  onRename: () => void;
  onDelete: (listId: string) => void;
}

/** 清单操作入口：重命名 / 删除（删除走二次确认弹窗）。 */
function ListActions({ activeList, busy, onRename, onDelete }: ListActionsProps) {
  const { t } = useTranslation();
  const [actionsOpen, setActionsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const { menuRef: actionsMenuRef, position: actionsMenuPos } = useAnchoredLayer({ triggerRef: actionsRef, open: actionsOpen, close: () => setActionsOpen(false), width: 144, align: "end" });

  return (
    <div ref={actionsRef} className="shrink-0">
      <Tooltip content={t("todo.listActions")} placement="bottom" align="end">
        <button type="button" aria-label={t("todo.listActions")} aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((value) => !value)} disabled={busy} className={ACTION_CLASS}>
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
      </Tooltip>
      {actionsOpen ? (
        <ListActionsMenu menuRef={actionsMenuRef} position={actionsMenuPos} onRename={() => { setActionsOpen(false); onRename(); }} onDeleteRequest={() => { setActionsOpen(false); setConfirmDelete(true); }} />
      ) : null}
      <DeleteListDialog open={confirmDelete} listName={activeList.name} busy={busy} onClose={() => setConfirmDelete(false)} onConfirm={() => { onDelete(activeList.id); setConfirmDelete(false); }} />
    </div>
  );
}

interface ListMenuProps {
  lists: TaskListDto[];
  counts: Record<string, number>;
  activeListId: string | null;
  menuRef: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  onSelect: (listId: string) => void;
}

function ListMenu({ lists, counts, activeListId, menuRef, position, onSelect }: ListMenuProps) {
  const { t } = useTranslation();
  return createPortal(
    <div ref={menuRef} role="menu" aria-label={t("todo.title")} style={position} className={`${MENU_CLASS} w-52`}>
      {lists.map((list) => (
        <button key={list.id} type="button" role="menuitem" aria-current={list.id === activeListId} onClick={() => onSelect(list.id)} className={`${MENU_ITEM_CLASS} ${list.id === activeListId ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}>
          <span className="min-w-0 flex-1 truncate">{list.name}</span>
          <span className="shrink-0 text-xs text-text-tertiary">{counts[list.id] ?? 0}</span>
          {list.id === activeListId ? <Check size={13} strokeWidth={2.5} aria-hidden="true" className="shrink-0" /> : null}
        </button>
      ))}
    </div>,
    document.body,
  );
}

interface ListActionsMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  position: CSSProperties;
  onRename: () => void;
  onDeleteRequest: () => void;
}

function ListActionsMenu({ menuRef, position, onRename, onDeleteRequest }: ListActionsMenuProps) {
  const { t } = useTranslation();
  return createPortal(
    <div ref={menuRef} role="menu" aria-label={t("todo.listActions")} style={position} className={`${MENU_CLASS} w-36`}>
      <button type="button" role="menuitem" onClick={onRename} className={`${MENU_ITEM_CLASS} text-text-primary hover:bg-bg-tertiary`}>
        <Pencil size={13} aria-hidden="true" className="text-text-tertiary" />
        {t("todo.renameList")}
      </button>
      <button type="button" role="menuitem" onClick={onDeleteRequest} className={`${MENU_ITEM_CLASS} text-danger hover:bg-danger/10`}>
        <Trash2 size={13} aria-hidden="true" />
        {t("todo.deleteList")}
      </button>
    </div>,
    document.body,
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
      className="h-7 w-36 min-w-0 rounded-md border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none"
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
