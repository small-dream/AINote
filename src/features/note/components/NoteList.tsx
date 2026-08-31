import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import type { NoteMeta } from "@/api/types";
import {
  useDeleteNoteMutation,
  useNoteListQuery,
} from "@/queries/note.queries";
import { useSessionStore } from "@/stores/session.store";
import { MoveNoteDialog } from "./MoveNoteDialog";
import { useTranslation } from "@/i18n";

interface NoteListProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: () => void;
}

/** 笔记列表：全部笔记 + 删除 / 重命名（P0-2 / P0-3；新建入口提升到工作区） */
export function NoteList({ repoPath, onSelect, onRequestNew }: NoteListProps) {
  const { data: notes, isLoading } = useNoteListQuery(repoPath);
  const remove = useDeleteNoteMutation();
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <NoteListHeader onNew={onRequestNew} />
      <NoteListBody
        notes={notes ?? []}
        isLoading={isLoading}
        currentNotePath={currentNotePath}
        onSelect={onSelect}
        onMove={setMoveTarget}
        onDelete={(path) => remove.mutate(path)}
      />
      <MoveNoteDialog
        key={moveTarget ?? "none"}
        path={moveTarget}
        onClose={() => setMoveTarget(null)}
        onMoved={(to) => onSelect(to)}
      />
    </div>
  );
}

function NoteListHeader({ onNew }: { onNew: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between border-b border-border px-4 py-3">
      <div>
        <p className="text-[15px] font-semibold">{t("note.all")}</p>
        <p className="mt-0.5 text-xs text-text-tertiary">{t("note.recentSort")}</p>
      </div>
      <Button aria-label={t("tree.newNote")} title={t("tree.newNote")} variant="primary" className="h-8 px-2.5 text-xs" onClick={onNew}>
        + {t("common.create")}
      </Button>
    </header>
  );
}

interface NoteListBodyProps {
  notes: NoteMeta[];
  isLoading: boolean;
  currentNotePath: string | null;
  onSelect: (path: string) => void;
  onMove: (path: string) => void;
  onDelete: (path: string) => void;
}

function NoteListBody({
  notes,
  isLoading,
  currentNotePath,
  onSelect,
  onMove,
  onDelete,
}: NoteListBodyProps) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-y-auto px-2 py-3">
      {isLoading && <p className="px-2 py-1 text-sm text-text-secondary">{t("common.loading")}</p>}
      {!isLoading && notes.length === 0 && (
        <div className="mx-2 mt-8 rounded-lg border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm font-medium text-text-primary">{t("note.none")}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{t("note.noneDescription")}</p>
        </div>
      )}
      {notes.map((note) => (
        <NoteListItem
          key={note.path}
          note={note}
          active={note.path === currentNotePath}
          onSelect={onSelect}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface NoteListItemProps {
  note: NoteMeta;
  active: boolean;
  onSelect: (path: string) => void;
  onMove: (path: string) => void;
  onDelete: (path: string) => void;
}

function NoteListItem({ note, active, onSelect, onMove, onDelete }: NoteListItemProps) {
  const { locale, t } = useTranslation();
  function handleDelete() {
    if (window.confirm(t("note.listDeleteConfirm", { name: note.title }))) onDelete(note.path);
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors ${
        active ? "bg-accent-soft" : "hover:bg-bg-secondary"
      }`}
    >
      <button
        className="min-w-0 flex-1 truncate text-left text-sm text-text-primary"
        onClick={() => onSelect(note.path)}
      >
        <span className="block truncate">{note.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-text-tertiary">{formatUpdatedAt(note.updatedAt, locale)}</span>
      </button>
      <button
        title={t("note.moving")}
        className="shrink-0 px-1 text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={() => onMove(note.path)}
      >
        ↗
      </button>
      <button
        title={t("common.delete")}
        className="shrink-0 px-1 text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={handleDelete}
      >
        ×
      </button>
    </div>
  );
}

function formatUpdatedAt(timestamp: number, locale: string) {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric" }).format(date);
}
