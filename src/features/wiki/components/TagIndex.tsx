import { useState } from "react";
import { Hash, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import { useNoteListQuery } from "@/queries/note.queries";
import type { NoteWikiDto } from "@/api/types";
import { buildTagCloud, buildTagNotes, filterTagCloud, type TagCloudItem } from "../utils/wiki";
import { useUiStore } from "@/stores/ui.store";

interface TagIndexProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 侧边栏标签索引：全局标签云 + 展开标签下的笔记列表（P1-5） */
export function TagIndex({ repoPath, onSelect }: TagIndexProps) {
  const { t } = useTranslation();
  const { data: notes = [], isLoading } = useWikiIndexQuery(repoPath);
  const { data: noteMetas = [] } = useNoteListQuery(repoPath);
  const focusedTag = useUiStore((s) => s.focusedTag);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(focusedTag);
  const [prevFocused, setPrevFocused] = useState<string | null>(focusedTag);
  if (focusedTag !== prevFocused) {
    setPrevFocused(focusedTag);
    if (focusedTag) setSelected(focusedTag);
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-text-secondary">{t("common.loading")}</div>;
  }
  const updatedAtByPath = new Map(noteMetas.map((note) => [note.path, note.updatedAt]));
  const tags = filterTagCloud(buildTagCloud(notes), query);
  if (tags.length === 0) {
    return <TagEmptyState isLoading={isLoading} hasTags={buildTagCloud(notes).length > 0} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("wiki.tags")}</span>
      </div>
      <TagSearch value={query} onChange={setQuery} />
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label={t("wiki.tags")}>
        {tags.map((tag) => (
          <TagRow
            key={tag.name}
            tag={tag}
            notes={notes}
            updatedAtByPath={updatedAtByPath}
            expanded={selected === tag.name}
            focused={focusedTag === tag.name}
            onToggle={() => setSelected(selected === tag.name ? null : tag.name)}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </div>
  );
}

interface TagRowProps {
  tag: TagCloudItem;
  notes: NoteWikiDto[];
  updatedAtByPath: Map<string, number>;
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
  onSelect: (path: string) => void;
}

function TagRow({ tag, notes, updatedAtByPath, expanded, focused, onToggle, onSelect }: TagRowProps) {
  const taggedNotes = buildTagNotes(notes, tag.name, updatedAtByPath);
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-current={focused && expanded ? "true" : undefined}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-bg-secondary ${focused ? "bg-accent/10 text-accent" : "text-text-primary"}`}
      >
        <Hash size={13} className="shrink-0 text-text-tertiary" />
        <span className="truncate">{tag.name}</span>
        <span className="ml-auto text-xs text-text-tertiary">{tag.count}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {taggedNotes.map(({ note }) => (
            <button
              key={note.path}
              type="button"
              onClick={() => onSelect(note.path)}
              className="block w-full truncate px-2 py-1 text-left text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              {note.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TagSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <label className="shrink-0 border-b border-border px-3 py-2">
      <span className="sr-only">{t("wiki.searchTags")}</span>
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg-primary px-2 py-1.5">
        <Search size={14} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("wiki.searchTags")}
          aria-label={t("wiki.searchTags")}
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
    </label>
  );
}

function TagEmptyState({ isLoading, hasTags }: { isLoading: boolean; hasTags: boolean }) {
  const { t } = useTranslation();
  if (isLoading) return <p className="p-4 text-sm text-text-secondary">{t("common.loading")}</p>;
  return (
    <div className="p-4 text-sm text-text-secondary">
      {hasTags ? t("wiki.tagSearchEmpty") : t("wiki.noTags")}
    </div>
  );
}
