import { Hash, Link2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/i18n";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import type { NoteWikiDto } from "@/api/types";
import { findBacklinks, resolveWikiTarget } from "../utils/wiki";

interface WikiPanelProps {
  repoPath: string | null;
  path: string | null;
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

interface OutgoingLink {
  name: string;
  target: string | null;
}

/** 双链与标签面板（P1-5）：当前笔记的标签 / 引用（出链）/ 反向链接 */
export function WikiPanel({ repoPath, path, open, onClose, onOpenNote }: WikiPanelProps) {
  const { t } = useTranslation();
  const { data: notes = [] } = useWikiIndexQuery(repoPath);
  if (!open || !path) return null;

  const note = notes.find((n) => n.path === path);
  const tags = note?.tags ?? [];
  const outgoing: OutgoingLink[] = (note?.links ?? []).map((name) => ({
    name,
    target: resolveWikiTarget(notes, name),
  }));
  const backlinks = findBacklinks(notes, path);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("wiki.title")} className="mx-auto mt-16 flex h-[70vh] w-[min(680px,90vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl">
        <PanelHeader path={path} onClose={onClose} />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <TagsSection tags={tags} />
          <OutgoingSection links={outgoing} onOpenNote={onOpenNote} />
          <BacklinksSection backlinks={backlinks} onOpenNote={onOpenNote} />
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

function TagsSection({ tags }: { tags: string[] }) {
  const { t } = useTranslation();
  if (tags.length === 0) return <SectionBlock title={t("wiki.tags")} empty={t("wiki.tagsEmpty")} />;
  return (
    <SectionBlock title={t("wiki.tags")}>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">
            <Hash size={11} /> {tag}
          </span>
        ))}
      </div>
    </SectionBlock>
  );
}

function OutgoingSection({ links, onOpenNote }: { links: OutgoingLink[]; onOpenNote: (path: string) => void }) {
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
              <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                <Link2 size={13} /> {link.name}
                <span className="rounded bg-bg-tertiary px-1.5 py-0.5 text-[11px]">{t("wiki.notCreated")}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}

function BacklinksSection({ backlinks, onOpenNote }: { backlinks: NoteWikiDto[]; onOpenNote: (path: string) => void }) {
  const { t } = useTranslation();
  if (backlinks.length === 0) return <SectionBlock title={t("wiki.backlinks")} empty={t("wiki.noBacklinks")} />;
  return (
    <SectionBlock title={t("wiki.backlinks")}>
      <ul className="space-y-1">
        {backlinks.map((note) => (
          <li key={note.path}>
            <button type="button" onClick={() => onOpenNote(note.path)} className="text-sm text-accent hover:underline">
              {note.title}
            </button>
            <span className="ml-2 text-[11px] text-text-tertiary">{note.path}</span>
          </li>
        ))}
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
