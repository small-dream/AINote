import { useMemo } from "react";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import { useCreateNoteMutation } from "@/queries/note.queries";
import type { NoteKind } from "@/api/types";
import {
  buildTagSuggestions,
  buildWikiNameIndex,
  findBacklinksByIndex,
  resolveWikiTargetByIndex,
  wikiCreatePath,
} from "../utils/wiki";
import { extractTagsFromContent } from "../utils/tagContent";

export interface OutgoingLink {
  name: string;
  target: string | null;
}

/** WikiPanel 数据编排：名称索引随 notes 预建（O(n)），出链/反链/标签建议各自 useMemo，
 * 编辑区击键（draft 变化）不再触发 O(n²) 反链重算。 */
export function useWikiPanel(repoPath: string | null, path: string | null, draft: string, kind: NoteKind) {
  const { data: notes = [] } = useWikiIndexQuery(repoPath);
  const createNote = useCreateNoteMutation();
  const nameIndex = useMemo(() => buildWikiNameIndex(notes), [notes]);
  const note = notes.find((n) => n.path === path);
  const tags = useMemo(() => extractTagsFromContent(draft, kind), [draft, kind]);
  const suggestions = useMemo(() => buildTagSuggestions(notes, tags), [notes, tags]);
  const outgoing: OutgoingLink[] = useMemo(
    () => (note?.links ?? []).map((name) => ({ name, target: resolveWikiTargetByIndex(nameIndex, name) })),
    [note, nameIndex],
  );
  const backlinks = useMemo(
    () => (path ? findBacklinksByIndex(notes, nameIndex, path) : []),
    [notes, nameIndex, path],
  );

  const handleCreate = async (name: string) => {
    await createNote.mutateAsync({ path: wikiCreatePath(name), kind: "markdown", content: `# ${name}\n` });
  };

  return { notes, nameIndex, tags, suggestions, outgoing, backlinks, creating: createNote.isPending, handleCreate };
}
