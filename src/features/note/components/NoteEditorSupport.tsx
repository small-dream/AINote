import { lazy, Suspense, useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { EditorView } from "@codemirror/view";
import { EditorToolbar, type ViewMode } from "./EditorToolbar";
import { MarkdownEditorSurface, type MarkdownEditorSurfaceProps } from "./MarkdownEditorSurface";
import { AiWriteControls } from "@/features/ai/components/AiWriteControls";
import { AskAiPanel } from "@/features/ai/components/AskAiPanel";
import { WikiPanel } from "@/features/wiki/components/WikiPanel";
import { useUiStore } from "@/stores/ui.store";
import { useAiWrite } from "@/features/ai/hooks/useAiWrite";
import { useAiSuggest } from "@/features/ai/hooks/useAiSuggest";
import { getMarkdownSelection, applyToMarkdownEditor } from "@/features/ai/utils/editorAdapters";
import { upsertFrontmatterSummary } from "@/features/ai/utils/frontmatter";
import { applyTitleToMarkdown } from "@/features/ai/utils/titles";
import { noteDisplayName } from "../utils/displayName";
import type { OutlineItem } from "../utils/outline";
import type { useEditorWiki } from "@/features/wiki/hooks/useEditorWiki";
import type { useNoteHistory } from "@/features/history/hooks/useNoteHistory";
import type { usePdfExport } from "@/features/export/hooks/usePdfExport";
import { useTranslation } from "@/i18n";

const LazyRichTextEditor = lazy(() => import("@/features/richtext/components/RichTextEditor").then(({ RichTextEditor }) => ({ default: RichTextEditor })));
const LazyHistoryPanel = lazy(() => import("@/features/history/components/HistoryPanel").then(({ HistoryPanel }) => ({ default: HistoryPanel })));
const LazyPdfExportOverlay = lazy(() => import("@/features/export/components/PdfExportOverlay").then(({ PdfExportOverlay }) => ({ default: PdfExportOverlay })));

export interface NoteEditorContentProps {
  notePath: string;
  repoPath: string | null;
  kind: "markdown" | "richText";
  draft: string;
  onChange: (value: string) => void;
  onMove: (path: string) => void;
  onOpenNote: (path: string) => void;
  createdPath?: string | null;
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  setOutlineOpen: Dispatch<SetStateAction<boolean>>;
  outlineOpen: boolean;
  surfaceProps: MarkdownEditorSurfaceProps;
  handleConvertNote: (to: string, content: string) => void;
  handleConvertToRichText: () => void;
  flush: () => Promise<void>;
  saving: boolean;
  dirty: boolean;
  saveError: string | null;
  history: ReturnType<typeof useNoteHistory>;
  wiki: ReturnType<typeof useEditorWiki>;
  ai: ReturnType<typeof useAiWrite>;
  suggest: ReturnType<typeof useAiSuggest>;
  askAiOpen: boolean;
  closeAskAi: () => void;
  insertAnswer: (text: string) => void;
  pdf: ReturnType<typeof usePdfExport>;
}

export function NoteEditorContent({ notePath, repoPath, kind, draft, onChange, onMove, onOpenNote, createdPath = null, mode, setMode, setOutlineOpen, outlineOpen, surfaceProps, handleConvertNote, handleConvertToRichText, flush, saving, dirty, saveError, history, wiki, ai, suggest, askAiOpen, closeAskAi, insertAnswer, pdf }: NoteEditorContentProps) {
  const richText = kind === "richText";
  return <div className="flex h-full min-h-0 flex-col bg-bg-primary">
    <EditorToolbar path={notePath} mode={mode} richText={richText} saving={saving} dirty={dirty} saveError={saveError} onModeChange={setMode} onSave={() => void flush().catch(() => undefined)} onMove={() => onMove(notePath)} onHistory={history.openHistory} onWiki={wiki.openPanel} onConvertToRichText={handleConvertToRichText} onExportPdf={() => void pdf.request()} {...(richText ? {} : { onAi: ai.openMenu })} isNewNote={notePath === createdPath} draft={draft} onTitleChange={onChange} onFlush={flush} onRenamed={onOpenNote} />
    <Suspense fallback={<EditorLoading />}>{richText ? <LazyRichTextEditor key={`${repoPath}:${notePath}:${history.reloadEpoch}`} content={draft} onChange={onChange} repoPath={repoPath} onOpenWiki={wiki.handleOpenWiki} notePath={notePath} onConvert={handleConvertNote} outlineOpen={outlineOpen} onOutlineToggle={() => setOutlineOpen((o) => !o)} /> : <MarkdownEditorSurface {...surfaceProps} />}</Suspense>
    <AiWriteControls ai={ai} canSummarize={!richText} canSuggest={!richText} suggest={suggest} />
    <AskAiPanel open={askAiOpen} noteContent={draft} canInsert={!richText} onInsert={insertAnswer} onClose={closeAskAi} />
    {history.open ? <Suspense fallback={null}><LazyHistoryPanel repoPath={repoPath} path={notePath} open onClose={history.closeHistory} onRestored={history.onRestored} /></Suspense> : null}
    <WikiPanel
      repoPath={repoPath}
      path={notePath}
      open={wiki.open}
      onClose={wiki.closePanel}
      onOpenNote={onOpenNote}
      draft={draft}
      kind={kind}
      onChange={onChange}
    />
    {pdf.open ? <Suspense fallback={null}><LazyPdfExportOverlay open title={pdf.title} kind={kind} content={draft} repoPath={repoPath} onClose={pdf.close} /></Suspense> : null}
  </div>;
}

function EditorLoading() {
  return <div className="flex min-h-0 flex-1 items-center justify-center bg-bg-primary" aria-busy="true" />;
}

export function useHistoryRequest(requestPath: string | null, notePath: string | null, onHandled: (() => void) | undefined, openHistory: () => void) {
  useEffect(() => {
    if (requestPath !== notePath || !notePath) return;
    openHistory();
    onHandled?.();
  }, [requestPath, notePath, onHandled, openHistory]);
}

export function useEditorAi(viewRef: RefObject<EditorView | null>, notePath: string | null, draft: string, onChange: (value: string) => void) {
  const askAiOpen = useUiStore((state) => state.askAiOpen);
  const closeAskAi = useUiStore((state) => state.closeAskAi);
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
  return { ai, suggest, askAiOpen, closeAskAi, insertAnswer: (text: string) => onChange(draft ? `${draft}\n\n${text}` : text) };
}

export function selectOutline(item: OutlineItem, mode: ViewMode, editorView: EditorView | null, preview: HTMLDivElement | null): void {
  if (mode !== "preview" && editorView?.dom.isConnected) {
    const line = editorView.state.doc.line(Math.min(item.line, editorView.state.doc.lines));
    editorView.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
    editorView.focus();
  }
  if (mode !== "edit") scrollPreviewToHeading(preview, item);
}

function scrollPreviewToHeading(preview: HTMLDivElement | null, item: OutlineItem): void {
  if (!preview) return;
  const headings = preview.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
  const heading = Array.from(headings).find((element) => element.dataset.line === String(item.line))
    ?? Array.from(headings).find((element) => element.id === item.id);
  if (!heading) return;
  heading.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
  alignPreviewHeading(preview, heading);
  globalThis.requestAnimationFrame?.(() => alignPreviewHeading(preview, heading));
}

function alignPreviewHeading(preview: HTMLDivElement, heading: HTMLElement): void {
  const previewRect = preview.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const target = preview.scrollTop + headingRect.top - previewRect.top - (preview.clientHeight - headingRect.height) / 2;
  preview.scrollTop = Math.max(0, target);
}

export function EditorState({ notePath, error }: { notePath: string | null; error: string | null }) {
  const { t } = useTranslation();
  return notePath ? <div className="flex h-full items-center justify-center text-sm text-danger">{t("note.loadFailed", { message: error ?? "" })}</div> : <div className="flex h-full items-center justify-center text-sm text-text-secondary">{t("note.empty")}</div>;
}

export function isEditorUnavailable(notePath: string | null, error: unknown): boolean {
  return notePath === null || error !== null;
}
