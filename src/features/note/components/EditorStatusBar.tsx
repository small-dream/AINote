import { AlignVerticalJustifyCenter, Maximize2, Minimize2 } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import { useTranslation } from "@/i18n";
import { useUiStore } from "@/stores/ui.store";
import { countCharacters, type EditorPosition, type EditorStats } from "../utils/editorStats";

interface EditorStatusBarProps {
  characters: number;
  cursor: EditorPosition;
}

/** 编辑区底部状态栏：字数、行列与两个常用手感开关；低频信息保持克制。 */
export function EditorStatusBar({ characters, cursor }: EditorStatusBarProps) {
  const { t } = useTranslation();
  const focusMode = useUiStore((state) => state.focusMode);
  const typewriterMode = useUiStore((state) => state.typewriterMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);
  const setTypewriterMode = useUiStore((state) => state.setTypewriterMode);
  return (
    <div className="editor-status-bar flex min-h-8 shrink-0 items-center gap-3 border-t border-border bg-bg-primary px-3 text-xs text-text-tertiary">
      <span>{t("editor.characters", { count: characters })}</span>
      <span aria-hidden="true" className="h-3 w-px bg-border" />
      <span>{t("editor.position", { line: cursor.line, column: cursor.column })}</span>
      <div className="ml-auto flex items-center gap-0.5">
        <IconButton size="sm" icon={AlignVerticalJustifyCenter} label={typewriterMode ? t("editor.typewriterOff") : t("editor.typewriterOn")} active={typewriterMode} onClick={() => setTypewriterMode(!typewriterMode)} />
        <IconButton size="sm" icon={focusMode ? Minimize2 : Maximize2} label={focusMode ? t("editor.exitFocusMode") : t("editor.focusMode")} active={focusMode} onClick={toggleFocusMode} />
      </div>
    </div>
  );
}

/** Markdown 与富文本共用状态栏：按编辑类型选择字数与行列来源。 */
export function NoteEditorStatusBar({ richText, draft, richStats, markdownCursor }: { richText: boolean; draft: string; richStats: EditorStats; markdownCursor: EditorPosition | undefined }) {
  if (richText) return <EditorStatusBar characters={richStats.characters} cursor={richStats} />;
  return <EditorStatusBar characters={countCharacters(draft)} cursor={markdownCursor ?? { line: 1, column: 1 }} />;
}
