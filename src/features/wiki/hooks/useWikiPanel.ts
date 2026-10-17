import { useMemo } from "react";
import { useWikiIndexQuery, useConvertMentionsMutation, useUnlinkedMentionsQuery } from "@/queries/wiki.queries";
import { useCreateNoteMutation } from "@/queries/note.queries";
import { reportToastError } from "@/stores/toast.store";
import type { NoteKind, UnlinkedMentionRef } from "@/api/types";
import type { NoteNavigationTarget } from "@/stores/session.store";
import { addMarkdownAlias, parseMarkdownAliases, removeMarkdownAlias } from "../utils/aliases";
import {
  buildTagSuggestions,
  buildWikiNameIndex,
  findBacklinksByIndex,
  parseWikiTarget,
  resolveWikiTargetByIndex,
  wikiCreatePath,
} from "../utils/wiki";
import { extractTagsFromContent } from "../utils/tagContent";

export interface OutgoingLink {
  name: string;
  target: string | null;
  heading: string | null;
}

/** WikiPanel 数据编排：索引随 notes 预建，提及只在面板打开时加载。 */
export function useWikiPanel(
  repoPath: string | null,
  path: string | null,
  draft: string,
  kind: NoteKind,
  open: boolean,
  onChange: (value: string) => void,
  onOpenNote: (targetPath: string, target?: NoteNavigationTarget) => void,
) {
  const { data: notes = [] } = useWikiIndexQuery(repoPath);
  const createNote = useCreateNoteMutation();
  const mentions = useUnlinkedMentionsQuery(repoPath, path, open);
  const convert = useConvertMentionsMutation(repoPath, path);
  const nameIndex = useMemo(() => buildWikiNameIndex(notes), [notes]);
  const note = notes.find((item) => item.path === path);
  const tags = useMemo(() => extractTagsFromContent(draft, kind), [draft, kind]);
  const suggestions = useMemo(() => buildTagSuggestions(notes, tags), [notes, tags]);
  const aliases = useMemo(() => (kind === "markdown" ? parseMarkdownAliases(draft) : []), [draft, kind]);
  const outgoing: OutgoingLink[] = useMemo(
    () => (note?.links ?? []).map((name) => {
      const parsed = parseWikiTarget(name);
      const context = note?.linkContexts?.find((item) => parseWikiTarget(item.target).name === parsed.name);
      return { name, target: resolveWikiTargetByIndex(nameIndex, name), heading: parsed.heading ?? context?.heading ?? null };
    }),
    [note, nameIndex],
  );
  const backlinks = useMemo(
    () => (path ? findBacklinksByIndex(notes, nameIndex, path) : []),
    [notes, nameIndex, path],
  );

  const handleCreate = async (name: string) => {
    try {
      await createNote.mutateAsync({ path: wikiCreatePath(name), kind: "markdown", content: `# ${parseWikiTarget(name).name}\n` });
    } catch (error) {
      reportToastError(error);
    }
  };
  const handleOpen = (targetPath: string, heading: string | null = null) => {
    if (heading) onOpenNote(targetPath, { path: targetPath, heading });
    else onOpenNote(targetPath);
  };
  const handleConvert = async (refs: UnlinkedMentionRef[]) => {
    try {
      await convert.mutateAsync(refs);
    } catch (error) {
      reportToastError(error);
    }
  };

  return {
    notes, nameIndex, tags, suggestions, aliases, outgoing, backlinks,
    mentions: mentions.data ?? [], mentionsLoading: mentions.isLoading,
    creating: createNote.isPending, converting: convert.isPending,
    handleCreate, handleOpen, handleConvert,
    addAlias: (alias: string) => onChange(addMarkdownAlias(draft, alias)),
    removeAlias: (alias: string) => onChange(removeMarkdownAlias(draft, alias)),
  };
}
