import { useCallback, useState } from "react";
import { useWikiIndexQuery } from "@/queries/wiki.queries";
import { useToastStore } from "@/stores/toast.store";
import { useTranslation } from "@/i18n";
import type { NoteNavigationTarget } from "@/stores/session.store";
import { findWikiHeading, parseWikiTarget, resolveWikiTarget } from "../utils/wiki";

/** 编辑器双链交互：面板开关 + `[[笔记#标题]]` 点击 → 打开目标并定位。 */
export function useEditorWiki(repoPath: string | null, onOpenNote: (path: string, target?: NoteNavigationTarget) => void) {
  const [open, setOpen] = useState(false);
  const { data: notes = [] } = useWikiIndexQuery(repoPath);
  const { t } = useTranslation();

  const handleOpenWiki = useCallback(
    (raw: string) => {
      const parsed = parseWikiTarget(raw);
      const target = resolveWikiTarget(notes, raw);
      if (!target) {
        setOpen(true);
        return;
      }
      if (!parsed.heading) {
        onOpenNote(target);
        return;
      }
      const heading = findWikiHeading(notes, raw);
      if (!heading) {
        useToastStore.getState().push(t("wiki.headingMissing", { heading: parsed.heading }), "info");
        onOpenNote(target);
        return;
      }
      onOpenNote(target, { path: target, heading: heading.text, line: heading.line });
    },
    [notes, onOpenNote, t]
  );

  return {
    notes,
    open,
    openPanel: () => setOpen(true),
    closePanel: () => setOpen(false),
    handleOpenWiki,
  };
}
