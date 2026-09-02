import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useNoteHistory } from "@/features/history/hooks/useNoteHistory";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { useEditorViewReady } from "../hooks/useEditorViewReady";
import { useEditorScrollPersistence } from "../hooks/useEditorScrollPersistence";
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
import { dispatchFormat } from "../hooks/useFormatCommands";
import { insertCallout } from "../utils/insert";
import { useUiStore } from "@/stores/ui.store";
import { RichTextEditor } from "@/features/richtext/components/RichTextEditor";
import { useNoteConversion } from "../hooks/useNoteConversion";
import { useAiWrite } from "@/features/ai/hooks/useAiWrite";
import { useAiSuggest } from "@/features/ai/hooks/useAiSuggest";
import { AiWriteControls } from "@/features/ai/components/AiWriteControls";
import { AskAiPanel } from "@/features/ai/components/AskAiPanel";
import { getMarkdownSelection, applyToMarkdownEditor } from "@/features/ai/utils/editorAdapters";
import { upsertFrontmatterSummary } from "@/features/ai/utils/frontmatter";
import { applyTitleToMarkdown } from "@/features/ai/utils/titles";
import { noteDisplayName } from "../utils/displayName";

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
    const { draft, kind, onChange, flush, loadError, saveError } = useNoteEditor(repoPath, notePath, history.reloadEpoch);
    const editorPreferences = useEditorPreferences(repoPath, notePath);
    const { onCreateEditor, viewRef } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);
    const wiki = useEditorWiki(repoPath, onOpenNote);
    const noteTheme = useUiStore((state) => state.noteTheme);
    const { mode, editorScrollTop, previewScrollTop, ratio } = editorPreferences.preferences;
    const { setMode, setRatio, setEditorScrollTop, setPreviewScrollTop } = editorPreferences;
    // Markdown 编辑视图固定软渲染（WYSIWYG）；分栏视图编辑侧固定源码 + 右侧实时预览
    const softRenderEnabled = mode !== "split";
    const { extensions, activeFormats } = useEditorExtensions({
      notes: wiki.notes,
      repoPath,
      onOpenWiki: wiki.handleOpenWiki,
      softRenderEnabled,
    });
    const { readyView, handleCreateEditor } = useEditorViewReady(onCreateEditor);
    const outline = useMemo(() => extractOutline(draft), [draft]);
    const asset = useAssetImport(readyView);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const { handleConvertNote, handleConvertToRichText } = useNoteConversion({ notePath, draft, flush, onOpenNote });
    const { ai, suggest, askAiOpen, closeAskAi, insertAnswer } = useEditorAi(viewRef, notePath, draft, onChange);
    useEditorScrollPersistence(readyView, previewRef, mode, { editorScrollTop, previewScrollTop, setEditorScrollTop, setPreviewScrollTop });
    useSyncScroll(readyView, previewRef, mode);
    useImperativeHandle(ref, () => ({ flush, setMode, insertCallout: () => { if (viewRef.current) dispatchFormat(viewRef.current, insertCallout); viewRef.current?.focus(); } }), [flush, setMode, viewRef]);
    const handleOutlineSelect = (item: OutlineItem) => { if (mode !== "preview" && readyView) { const line = readyView.state.doc.line(Math.min(item.line, readyView.state.doc.lines)); readyView.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) }); readyView.focus(); } if (mode !== "edit") scrollPreviewToHeading(previewRef.current, item.id); setOutlineOpen(false); };

    if (!notePath) return <EmptyState />;
    if (loadError) return <ErrorState message={loadError.message} />;
    const surfaceProps: MarkdownEditorSurfaceProps = { mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor: handleCreateEditor, previewRef, onOpenWiki: wiki.handleOpenWiki, wikiNotes: wiki.notes, ratio, onRatioChange: setRatio, outline, outlineOpen, onOutlineSelect: handleOutlineSelect, viewRef, activeFormats, onImagePicked: asset.handleFiles, assetStatus: asset.status, softRender: softRenderEnabled };

    return (
      <div className="flex h-full min-h-0 flex-col bg-bg-primary">
        <EditorToolbar path={notePath} mode={mode} richText={kind === "richText"} saveError={saveError?.message ?? null} onModeChange={setMode} onSave={() => void flush().catch(() => undefined)} onMove={() => onMove(notePath)} onHistory={history.openHistory} onWiki={wiki.openPanel} onOutline={() => setOutlineOpen((o) => !o)} onConvertToRichText={handleConvertToRichText} {...(kind === "richText" ? {} : { onAi: ai.openMenu })} />
        {kind === "richText" ? <RichTextEditor key={`${repoPath}:${notePath}:${history.reloadEpoch}`} content={draft} onChange={onChange} repoPath={repoPath} onOpenWiki={wiki.handleOpenWiki} notePath={notePath} onConvert={handleConvertNote} outlineOpen={outlineOpen} /> : <MarkdownEditorSurface {...surfaceProps} />}
        <AiWriteControls ai={ai} canSummarize={kind !== "richText"} canSuggest={kind !== "richText"} suggest={suggest} /><AskAiPanel open={askAiOpen} noteContent={draft} canInsert={kind !== "richText"} onInsert={insertAnswer} onClose={closeAskAi} />
        <HistoryPanel repoPath={repoPath} path={notePath} open={history.open} onClose={history.closeHistory} onRestored={history.onRestored} />
        <WikiPanel repoPath={repoPath} path={notePath} open={wiki.open} onClose={wiki.closePanel} onOpenNote={onOpenNote} />
      </div>
    );
  }
);

/** Markdown 编辑器的 AI 写作 + 问答面板编排（收敛接线，避免组件超长） */
function useEditorAi(viewRef: React.RefObject<EditorView | null>, notePath: string | null, draft: string, onChange: (value: string) => void) {
  const askAiOpen = useUiStore((s) => s.askAiOpen);
  const closeAskAi = useUiStore((s) => s.closeAskAi);
  const ai = useAiWrite({
    getSelection: () => ({ ...getMarkdownSelection(viewRef.current, notePath ? noteDisplayName(notePath.split("/").at(-1) ?? notePath) : undefined), fullText: draft }),
    onApply: (text) => applyToMarkdownEditor(viewRef.current, text),
    onApplySummary: (summary) => onChange(upsertFrontmatterSummary(draft, summary)),
  });
  const suggest = useAiSuggest({
    noteText: draft,
    onApplyTitle: (title) => onChange(applyTitleToMarkdown(draft, title)),
    onInsertOutline: (outline) => onChange(draft ? `${draft}\n\n${outline}` : outline),
  });
  const insertAnswer = (text: string) => onChange(draft ? `${draft}\n\n${text}` : text);
  return { ai, suggest, askAiOpen, closeAskAi, insertAnswer };
}

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
