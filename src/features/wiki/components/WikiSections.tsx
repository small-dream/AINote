import { Hash, Link2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import type { NoteWikiDto } from "@/api/types";
import { backlinkContextsByIndex, type WikiNameIndex } from "../utils/wiki";
import type { OutgoingLink } from "../hooks/useWikiPanel";

export function SectionBlock({ title, empty, children }: { title: string; empty?: string; children?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      {children ?? <p className="text-sm text-text-tertiary">{empty ?? t("common.loading")}</p>}
    </section>
  );
}

export function TagsSection({ tags, suggestions, onAdd, onRemove }: { tags: string[]; suggestions: string[]; onAdd: (tag: string) => void; onRemove: (tag: string) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  return (
    <SectionBlock title={t("wiki.tags")}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
            <Hash size={11} /> {tag}
            <Tooltip content={`${t("wiki.removeTag")} ${tag}`}>
              <button type="button" aria-label={`${t("wiki.removeTag")} ${tag}`} onClick={() => onRemove(tag)} className="ml-1 rounded-full text-accent/70 transition-colors hover:text-danger">
                <X size={11} />
              </button>
            </Tooltip>
          </span>
        ))}
      </div>
      <TagInput suggestions={suggestions} value={input} onChange={setInput} onSubmit={(tag) => { onAdd(tag); setInput(""); }} />
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
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
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

export function OutgoingSection({ links, creating, onOpen, onCreate }: { links: OutgoingLink[]; creating: boolean; onOpen: (path: string, heading: string | null) => void; onCreate: (name: string) => void }) {
  const { t } = useTranslation();
  if (links.length === 0) return <SectionBlock title={t("wiki.links")} empty={t("wiki.linksEmpty")} />;
  return (
    <SectionBlock title={t("wiki.links")}>
      <ul className="space-y-1">
        {links.map((link) => (
          <li key={link.name} className="flex items-center gap-2 text-sm">
            {link.target ? (
              <button type="button" onClick={() => onOpen(link.target as string, link.heading)} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                <Link2 size={13} /> {link.heading ? `${link.name.split("#")[0]}#${link.heading}` : link.name}
              </button>
            ) : (
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-text-tertiary">
                  <Link2 size={13} className="shrink-0" />
                  <span className="truncate">{link.name}</span>
                  <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px]">{t("wiki.notCreated")}</span>
                </span>
                <button type="button" disabled={creating} onClick={() => onCreate(link.name)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 px-2 py-0.5 text-xs text-accent transition-colors hover:bg-accent-soft disabled:opacity-50">
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

export function BacklinksSection({ backlinks, nameIndex, targetPath, onOpen }: { backlinks: NoteWikiDto[]; nameIndex: WikiNameIndex; targetPath: string; onOpen: (path: string, heading: string | null) => void }) {
  const { t } = useTranslation();
  if (backlinks.length === 0) return <SectionBlock title={t("wiki.backlinks")} empty={t("wiki.noBacklinks")} />;
  return (
    <SectionBlock title={t("wiki.backlinks")}>
      <ul className="space-y-2">
        {backlinks.map((note) => {
          const contexts = backlinkContextsByIndex(note, nameIndex, targetPath);
          return (
            <li key={note.path} className="rounded-lg border border-border/70 bg-bg-secondary/60 p-2">
              <button type="button" onClick={() => onOpen(note.path, null)} className="text-sm font-medium text-accent hover:underline">{note.title}</button>
              <span className="ml-2 text-[11px] text-text-tertiary">{note.path}</span>
              {contexts.map((context) => (
                <p key={`${context.line}-${context.snippet}`} className="mt-0.5 truncate text-xs text-text-secondary">
                  <span className="mr-1 inline-block rounded bg-bg-tertiary px-1 font-mono text-[10px] text-text-tertiary">L{context.line}</span>
                  {context.heading ? <span className="mr-1 text-accent">{context.heading}</span> : null}
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
