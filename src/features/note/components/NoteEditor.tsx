import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useNoteHistory } from "@/features/history/hooks/useNoteHistory";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { useEditorViewReady } from "../hooks/useEditorViewReady";
import { useSyncScroll } from "../hooks/useSyncScroll";
import { useAssetImport } from "@/features/asset/hooks/useAssetImport";
import { useEditorWiki } from "@/features/wiki/hooks/useEditorWiki";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import { WikiPanel } from "@/features/wiki/components/WikiPanel";
import { EditorToolbar } from "./EditorToolbar";
import { MarkdownEditorSurface, type MarkdownEditorSurfaceProps } from "./MarkdownEditorSurface";
import { extractOutline, type OutlineItem } from "../utils/outline";
import { useTranslation } from "@/i18n";
import { useEditorPreferences } from "../hooks/useEditorPreferences";
import { attachEditorScrollPersistence } from "../utils/editorScrollPersistence";
import { dispatchFormat } from "../hooks/useFormatCommands";
import { insertCallout } from "../utils/insert";
import { useUiStore } from "@/stores/ui.store";
import { RichTextEditor } from "@/features/richtext/components/RichTextEditor";

export type { NoteEditorHandle } from "../hooks/useNoteEditor";

interface NoteEditorProps {
  repoPath: string | null;
  notePath: string | null;
  onMove: (from: string) => void;
  /** 打开笔记（双链跳转目标） */
  onOpenNote: (path: string) => void;
  /** 新建打开时自动聚焦首行标题（P2） */
  focusTitleOnLoad?: boolean;
}

/** 笔记编辑器：按类型路由 Markdown（CodeMirror）或真富文本（TipTap）+ 防抖自动保存（P0-2） */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ repoPath, notePath, onMove, onOpenNote, focusTitleOnLoad = false }, ref) {
    const history = useNoteHistory();
    const [outlineOpen, setOutlineOpen] = useState(false);
    const { draft, kind, onChange, flush, saving, dirty, loadError, saveError } = useNoteEditor(repoPath, notePath, history.reloadEpoch);
    const { onCreateEditor, viewRef } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);
    const wiki = useEditorWiki(repoPath, onOpenNote);
    const { extensions, activeFormats } = useEditorExtensions(wiki.notes);
    const noteTheme = useUiStore((state) => state.noteTheme);
    const editorPreferences = useEditorPreferences(repoPath, notePath);
    const { readyView, handleCreateEditor } = useEditorViewReady(onCreateEditor);
    const outline = useMemo(() => extractOutline(draft), [draft]);
    const asset = useAssetImport(readyView);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const { mode, editorScrollTop, previewScrollTop } = editorPreferences.preferences;
    useEffect(() => { if (readyView) attachEditorScrollPersistence(readyView, previewRef.current, { editorScrollTop, previewScrollTop }, editorPreferences.setEditorScrollTop, editorPreferences.setPreviewScrollTop); }, [readyView, mode, editorScrollTop, previewScrollTop, editorPreferences]);
    useSyncScroll(readyView, previewRef, mode);
    useImperativeHandle(ref, () => ({ flush, setMode: editorPreferences.setMode, insertCallout: () => { if (viewRef.current) dispatchFormat(viewRef.current, insertCallout); viewRef.current?.focus(); } }), [editorPreferences, flush, viewRef]);
    const handleSave = () => { void flush().catch(() => undefined); };
    const handleOutlineSelect = (item: OutlineItem) => { if (mode !== "preview" && readyView) { const line = readyView.state.doc.line(Math.min(item.line, readyView.state.doc.lines)); readyView.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) }); readyView.focus(); } if (mode !== "edit") scrollPreviewToHeading(previewRef.current, item.id); setOutlineOpen(false); };

    if (!notePath) return <EmptyState />;
    if (loadError) return <ErrorState message={loadError.message} />;
    const isRichText = kind === "richText";
    const surfaceProps: MarkdownEditorSurfaceProps = { mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor: handleCreateEditor, previewRef, onOpenWiki: wiki.handleOpenWiki, wikiNotes: wiki.notes, ratio: editorPreferences.preferences.ratio, onRatioChange: editorPreferences.setRatio, outline, outlineOpen, onOutlineSelect: handleOutlineSelect, viewRef, activeFormats, onImagePicked: asset.handleFiles, assetStatus: asset.status };

    return (
      <div className="flex h-full min-h-0 flex-col bg-bg-primary">
        <EditorToolbar path={notePath} mode={mode} richText={isRichText} saving={saving} dirty={dirty} saveError={saveError?.message ?? null} onModeChange={editorPreferences.setMode} onSave={handleSave} onMove={() => onMove(notePath)} onHistory={history.openHistory} onWiki={wiki.openPanel} onOutline={() => setOutlineOpen((o) => !o)} />
        {isRichText ? <RichTextEditor key={`${notePath}:${history.reloadEpoch}`} content={draft} onChange={onChange} /> : <MarkdownEditorSurface {...surfaceProps} />}
        <HistoryPanel repoPath={repoPath} path={notePath} open={history.open} onClose={history.closeHistory} onRestored={history.onRestored} />
        <WikiPanel repoPath={repoPath} path={notePath} open={wiki.open} onClose={wiki.closePanel} onOpenNote={onOpenNote} />
      </div>
    );
  }
);

function scrollPreviewToHeading(preview: HTMLDivElement | null, id: string): void {
  const heading = preview ? Array.from(preview.querySelectorAll<HTMLElement>("[id]")).find((element) => element.id === id) : null;
  heading?.scrollIntoView?.({ block: "center" });
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
      {t("note.empty")}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center text-sm text-danger">
      {t("note.loadFailed", { message })}
    </div>
  );
}
