import { useState } from "react";
import { Hash } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import type { NoteWikiDto } from "@/api/types";
import { buildTagCloud, type TagCloudItem } from "../utils/wiki";
import { useUiStore } from "@/stores/ui.store";

interface TagIndexProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
}

/** 侧边栏标签索引：全局标签云 + 展开标签下的笔记列表（P1-5） */
export function TagIndex({ repoPath, onSelect }: TagIndexProps) {
  const { t } = useTranslation();
  const { data: notes = [], isLoading } = useWikiIndexQuery(repoPath);
  const focusedTag = useUiStore((s) => s.focusedTag);
  const [selected, setSelected] = useState<string | null>(focusedTag);
  const [prevFocused, setPrevFocused] = useState<string | null>(focusedTag);
  if (focusedTag !== prevFocused) {
    setPrevFocused(focusedTag);
    if (focusedTag) setSelected(focusedTag);
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-text-secondary">{t("common.loading")}</div>;
  }
  const tags = buildTagCloud(notes);
  if (tags.length === 0) {
    return <div className="p-4 text-sm text-text-secondary">{t("wiki.noTags")}</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-text-tertiary">{t("wiki.tags")}</span>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label={t("wiki.tags")}>
        {tags.map((tag) => (
          <TagRow
            key={tag.name}
            tag={tag}
            notes={notes}
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
  expanded: boolean;
  focused: boolean;
  onToggle: () => void;
  onSelect: (path: string) => void;
}

function TagRow({ tag, notes, expanded, focused, onToggle, onSelect }: TagRowProps) {
  const taggedNotes = notes.filter((n) => n.tags.includes(tag.name));
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
          {taggedNotes.map((note) => (
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
