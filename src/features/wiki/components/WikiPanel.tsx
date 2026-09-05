import { Hash, Link2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "@/i18n";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import { useCreateNoteMutation } from "@/queries/note.queries";
import type { NoteWikiDto } from "@/api/types";
import { backlinkContextsOf, findBacklinks, resolveWikiTarget, wikiCreatePath } from "../utils/wiki";
import { appendTagToContent, extractTagsFromContent, removeTagFromContent } from "../utils/tagContent";

interface WikiPanelProps {
  repoPath: string | null;
  path: string | null;
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
  draft: string;
  kind: "markdown" | "richText";
  onChange: (value: string) => void;
}

interface OutgoingLink {
  name: string;
  target: string | null;
}

/** 双链与标签面板（P1-5）：标签 / 引用（出链，未创建可快速建笔记）/ 反向链接（多上下文）。 */
export function WikiPanel({ repoPath, path, open, onClose, onOpenNote, draft, kind, onChange }: WikiPanelProps) {
  const { t } = useTranslation();
  const { data: notes = [] } = useWikiIndexQuery(repoPath);
  const createNote = useCreateNoteMutation();
  if (!open || !path) return null;

  const note = notes.find((n) => n.path === path);
  const tags = extractTagsFromContent(draft, kind);
  const suggestions = buildTagSuggestions(notes, tags);
  const outgoing: OutgoingLink[] = (note?.links ?? []).map((name) => ({
    name,
    target: resolveWikiTarget(notes, name),
  }));
  const backlinks = findBacklinks(notes, path);

  const handleCreate = async (name: string) => {
    const targetPath = wikiCreatePath(name);
    await createNote.mutateAsync({ path: targetPath, kind: "markdown", content: `# ${name}\n` });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("wiki.title")} className="mx-auto mt-16 flex h-[70vh] w-[min(680px,90vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl">
        <PanelHeader path={path} onClose={onClose} />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <TagsSection
            tags={tags}
            suggestions={suggestions}
            onAdd={(tag) => onChange(appendTagToContent(draft, tag, kind))}
            onRemove={(tag) => onChange(removeTagFromContent(draft, tag, kind))}
          />
          <OutgoingSection links={outgoing} creating={createNote.isPending} onOpenNote={onOpenNote} onCreate={handleCreate} />
          <BacklinksSection backlinks={backlinks} notes={notes} targetPath={path} onOpenNote={onOpenNote} />
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ path, onClose }: { path: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t("wiki.title")}</h2>
        <p className="truncate text-[11px] text-text-tertiary">{path}</p>
      </div>
      <button type="button" aria-label={t("common.cancel")} onClick={onClose} className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary">
        <X size={16} />
      </button>
    </div>
  );
}

function buildTagSuggestions(notes: NoteWikiDto[], currentTags: string[]): string[] {
  return [...new Set(notes.flatMap((note) => note.tags))]
    .filter((tag) => !currentTags.includes(tag))
    .sort((a, b) => a.localeCompare(b));
}

function TagsSection({ tags, suggestions, onAdd, onRemove }: { tags: string[]; suggestions: string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  return (
    <SectionBlock title={t("wiki.tags")}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
            <Hash size={11} /> {tag}
            <button type="button" aria-label={`${t("wiki.removeTag")} ${tag}`} onClick={() => onRemove(tag)} className="ml-1 rounded-full text-accent/70 transition-colors hover:text-danger">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <TagInput
        suggestions={suggestions}
        value={input}
        onChange={setInput}
        onSubmit={(tag) => {
          onAdd(tag);
          setInput("");
        }}
      />
    </SectionBlock>
  );
}

function TagInput({ suggestions, value, onChange, onSubmit }: { suggestions: string[]; value: string; onChange: (value: string) => void; onSubmit: (tag: string) => void }) {
  const { t } = useTranslation();
  const filtered = suggestions.filter((tag) => tag.includes(value.trim().toLocaleLowerCase()));
  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor="wiki-tag-input">{t("wiki.addTag")}</label>
      <input
        id="wiki-tag-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const tag = value.trim().replace(/^#/, "").toLocaleLowerCase();
          if (tag) onSubmit(tag);
        }}
        placeholder={t("wiki.addTag")}
        className="w-full rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
      />
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filtered.slice(0, 12).map((tag) => (
            <button key={tag} type="button" onClick={() => onSubmit(tag)} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent">
              <Hash size={10} /> {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OutgoingSection({ links, creating, onOpenNote, onCreate }: { links: OutgoingLink[]; creating: boolean; onOpenNote: (path: string) => void; onCreate: (name: string) => void }) {
  const { t } = useTranslation();
  if (links.length === 0) return <SectionBlock title={t("wiki.links")} empty={t("wiki.linksEmpty")} />;
  return (
    <SectionBlock title={t("wiki.links")}>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.name} className="flex items-center gap-2 text-sm">
            {link.target ? (
              <button type="button" onClick={() => onOpenNote(link.target as string)} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Link2 size={13} /> {link.name}
              </button>
            ) : (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-text-tertiary">
                  <Link2 size={13} className="shrink-0" />
                  <span className="truncate">{link.name}</span>
                  <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px]">{t("wiki.notCreated")}</span>
                </span>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => onCreate(link.name)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 px-2 py-0.5 text-xs text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
                >
                  <Plus size={12} /> {t("wiki.createNote")}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}

function BacklinksSection({ backlinks, notes, targetPath, onOpenNote }: { backlinks: NoteWikiDto[]; notes: NoteWikiDto[]; targetPath: string; onOpenNote: (path: string) => void }) {
  const { t } = useTranslation();
  if (backlinks.length === 0) return <SectionBlock title={t("wiki.backlinks")} empty={t("wiki.noBacklinks")} />;
  return (
    <SectionBlock title={t("wiki.backlinks")}>
      <ul className="space-y-2">
        {backlinks.map((note) => {
          const contexts = backlinkContextsOf(note, notes, targetPath);
          return (
            <li key={note.path} className="rounded-lg border border-border/70 bg-bg-secondary/60 p-2">
              <button type="button" onClick={() => onOpenNote(note.path)} className="text-sm font-medium text-accent hover:underline">
                {note.title}
              </button>
              <span className="ml-2 text-[11px] text-text-tertiary">{note.path}</span>
              {contexts.map((context) => (
                <p key={`${context.line}-${context.snippet}`} className="mt-0.5 truncate text-xs text-text-secondary">
                  <span className="mr-1 inline-block rounded bg-bg-tertiary px-1 font-mono text-[10px] text-text-tertiary">L{context.line}</span>
                  {context.snippet}
                </p>
              ))}
            </li>
          );
        })}
      </ul>
    </SectionBlock>
  );
}

function SectionBlock({ title, empty, children }: { title: string; empty?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      {children ?? <p className="text-sm text-text-tertiary">{empty ?? t("common.loading")}</p>}
    </section>
  );
}
