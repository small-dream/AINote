import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useNoteHistory } from "@/features/history/hooks/useNoteHistory";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { useEditorViewReady } from "../hooks/useEditorViewReady";
import { useEditorScrollPersistence } from "../hooks/useEditorScrollPersistence";
import { useSyncScroll } from "../hooks/useSyncScroll";
import { useAssetImport } from "@/features/asset/hooks/useAssetImport";
import { useEditorWiki } from "@/features/wiki/hooks/useEditorWiki";
import { type MarkdownEditorSurfaceProps } from "./MarkdownEditorSurface";
import { extractOutline, type OutlineItem } from "../utils/outline";
import { useEditorPreferences } from "../hooks/useEditorPreferences";
import { dispatchFormat } from "../hooks/useFormatCommands";
import { insertCallout } from "../utils/insert";
import { useUiStore } from "@/stores/ui.store";
import { useNoteConversion } from "../hooks/useNoteConversion";
import { usePdfExport } from "@/features/export/hooks/usePdfExport";
import { EditorState, isEditorUnavailable, NoteEditorContent, selectOutline, useEditorAi, useHistoryRequest } from "./NoteEditorSupport";

export type { NoteEditorHandle } from "../hooks/useNoteEditor";

interface NoteEditorProps {
  repoPath: string | null;
  notePath: string | null;
  onMove: (from: string) => void;
  onOpenNote: (path: string) => void;
  focusTitleOnLoad?: boolean;
  historyRequestPath?: string | null;
  onHistoryRequestHandled?: () => void;
}

/** 笔记编辑器：按类型路由编辑器，负责状态编排与跨功能接线。 */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ repoPath, notePath, onMove, onOpenNote, focusTitleOnLoad = false, historyRequestPath = null, onHistoryRequestHandled }, ref) {
    const history = useNoteHistory();
    const [outlineOpen, setOutlineOpen] = useState(false);
    const { draft, kind, onChange, flush, saving, dirty, loadError, saveError } = useNoteEditor(repoPath, notePath, history.reloadEpoch);
    const preferences = useEditorPreferences(repoPath, notePath);
    const { onCreateEditor, viewRef } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);
    const wiki = useEditorWiki(repoPath, onOpenNote);
    const noteTheme = useUiStore((state) => state.noteTheme);
    const { preferences: { mode, editorScrollTop, previewScrollTop, ratio }, setMode, setRatio, setEditorScrollTop, setPreviewScrollTop } = preferences;
    const pdf = usePdfExport({ notePath, kind, repoPath, flush });
    const softRenderEnabled = mode !== "split";
    const { extensions, activeFormats } = useEditorExtensions({ notes: wiki.notes, repoPath, onOpenWiki: wiki.handleOpenWiki, softRenderEnabled });
    const { readyView, handleCreateEditor } = useEditorViewReady(onCreateEditor);
    const outline = useMemo(() => extractOutline(draft), [draft]);
    const asset = useAssetImport(readyView);
    const previewRef = useRef<HTMLDivElement | null>(null);
    const { handleConvertNote, handleConvertToRichText } = useNoteConversion({ notePath, draft, flush, onOpenNote });
    const { ai, suggest, askAiOpen, closeAskAi, insertAnswer } = useEditorAi(viewRef, notePath, draft, onChange);
    useEditorScrollPersistence(readyView, previewRef, mode, { editorScrollTop, previewScrollTop, setEditorScrollTop, setPreviewScrollTop });
    useSyncScroll(readyView, previewRef, mode);
    useHistoryRequest(historyRequestPath, notePath, onHistoryRequestHandled, history.openHistory);
    useImperativeHandle(ref, () => ({ flush, setMode, openHistory: history.openHistory, insertCallout: () => { if (viewRef.current) dispatchFormat(viewRef.current, insertCallout); viewRef.current?.focus(); } }), [flush, setMode, history.openHistory, viewRef]);
    const handleOutlineSelect = (item: OutlineItem) => selectOutline(item, mode, viewRef.current ?? readyView, previewRef.current);

    if (isEditorUnavailable(notePath, loadError)) return <EditorState notePath={notePath} error={loadError?.message ?? null} />;
    const surfaceProps: MarkdownEditorSurfaceProps = { mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor: handleCreateEditor, previewRef, onOpenWiki: wiki.handleOpenWiki, wikiNotes: wiki.notes, ratio, onRatioChange: setRatio, outline, outlineOpen, onOutlineToggle: () => setOutlineOpen((open) => !open), onOutlineSelect: handleOutlineSelect, viewRef, activeFormats, onImagePicked: asset.handleFiles, assetStatus: asset.status, softRender: softRenderEnabled };
    return <NoteEditorContent notePath={notePath as string} repoPath={repoPath} kind={kind} draft={draft} onChange={onChange} onMove={onMove} onOpenNote={onOpenNote} mode={mode} setMode={setMode} setOutlineOpen={setOutlineOpen} outlineOpen={outlineOpen} surfaceProps={surfaceProps} handleConvertNote={handleConvertNote} handleConvertToRichText={handleConvertToRichText} flush={flush} saving={saving} dirty={dirty} saveError={saveError?.message ?? null} history={history} wiki={wiki} ai={ai} suggest={suggest} askAiOpen={askAiOpen} closeAskAi={closeAskAi} insertAnswer={insertAnswer} pdf={pdf} />;
  },
);
