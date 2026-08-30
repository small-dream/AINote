import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import type { NoteMeta } from "@/api/types";
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNoteListQuery,
} from "@/queries/note.queries";
import { useSessionStore } from "@/stores/session.store";
import { MoveNoteDialog } from "./MoveNoteDialog";
import { NewNoteDialog } from "./NewNoteDialog";

interface NoteListProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 笔记列表：全部笔记 + 新建 / 重命名 / 删除（P0-2 / P0-3） */
export function NoteList({ repoPath, onSelect }: NoteListProps) {
  const { data: notes, isLoading } = useNoteListQuery(repoPath);
  const create = useCreateNoteMutation();
  const remove = useDeleteNoteMutation();
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const [newOpen, setNewOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <NoteListHeader onNew={() => setNewOpen(true)} />
      <NoteListBody
        notes={notes ?? []}
        isLoading={isLoading}
        currentNotePath={currentNotePath}
        onSelect={onSelect}
        onMove={setMoveTarget}
        onDelete={(path) => remove.mutate(path)}
      />
      <NewNoteDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(path) => {
          create.mutate(path);
          onSelect(path);
          setNewOpen(false);
        }}
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
  return (
    <header className="flex items-center justify-between border-b border-bg-secondary px-4 py-2">
      <span className="text-sm font-medium">笔记列表</span>
      <Button variant="ghost" onClick={onNew}>
        ＋ 新建
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
  return (
    <div className="flex-1 overflow-y-auto p-2">
      {isLoading && <p className="px-2 py-1 text-sm text-text-secondary">加载中…</p>}
      {!isLoading && notes.length === 0 && (
        <p className="px-2 py-1 text-sm text-text-secondary">暂无笔记，点「新建」创建第一篇</p>
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
  function handleDelete() {
    if (window.confirm(`删除笔记「${note.title}」？此操作不可恢复。`)) onDelete(note.path);
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded px-2 py-1 ${
        active ? "bg-accent/15" : "hover:bg-bg-secondary"
      }`}
    >
      <button
        className="min-w-0 flex-1 truncate text-left text-sm text-text-primary"
        onClick={() => onSelect(note.path)}
      >
        {note.title}
      </button>
      <button
        title="重命名 / 移动"
        className="shrink-0 px-1 text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={() => onMove(note.path)}
      >
        ✎
      </button>
      <button
        title="删除"
        className="shrink-0 px-1 text-text-secondary opacity-0 group-hover:opacity-100"
        onClick={handleDelete}
      >
        🗑
      </button>
    </div>
  );
}
