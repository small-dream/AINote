import type { Extension } from "@codemirror/state";
import { lazy, Suspense, useCallback, useEffect, useRef, type MouseEvent, type ReactElement, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import type { NoteWikiDto } from "@/api/types";
import CodeMirror from "@uiw/react-codemirror";
import { SplitPane } from "./SplitPane";
import { NoteOutlineFloating } from "./NoteOutlineFloating";
import type { DiagnosticIssue } from "@/features/diagnostics/utils/diagnostics";
import { FormatToolbar } from "./FormatToolbar";
import type { ViewMode } from "./EditorToolbar";
import type { OutlineItem } from "../utils/outline";
import type { NoteTheme } from "@/stores/ui.store";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { MarkdownPreviewProps } from "./MarkdownPreview";

/** 预览渲染防抖窗口：击键后延迟重跑 Markdown 管线（与 3s 落盘防抖 AUTOSAVE_DEBOUNCE_MS 解耦）。 */
export const PREVIEW_DEBOUNCE_MS = 250;

const LazyMarkdownPreview = lazy(() => import("./MarkdownPreview").then(({ MarkdownPreview }) => ({ default: MarkdownPreview })));

/** CodeMirror 基础扩展配置：模块级常量，避免每次渲染生成新对象导致 @uiw/react-codemirror 重建全部扩展。 */
const SOURCE_BASIC_SETUP = { syntaxHighlighting: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true, foldGutter: false };
const SOFT_RENDER_BASIC_SETUP = { syntaxHighlighting: false, lineNumbers: false, highlightActiveLine: false, highlightActiveLineGutter: false, foldGutter: false };
const FOCUS_BASIC_SETUP = { syntaxHighlighting: true, lineNumbers: false, highlightActiveLine: false, highlightActiveLineGutter: false, foldGutter: false };

export interface MarkdownEditorSurfaceProps {
  mode: ViewMode;
  noteTheme: NoteTheme;
  repoPath: string | null;
  draft: string;
  onChange: (value: string) => void;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
  previewRef: RefObject<HTMLDivElement | null>;
  onOpenWiki: (name: string) => void;
  wikiNotes: NoteWikiDto[];
  ratio: number;
  onRatioChange: (ratio: number) => void;
  outline: OutlineItem[];
  outlineOpen: boolean;
  onOutlineToggle: () => void;
  onOutlineSelect: (item: OutlineItem) => void;
  diagnostics: DiagnosticIssue[];
  diagnosticsOpen: boolean;
  onDiagnosticsToggle: () => void;
  onDiagnosticsSelect: (issue: DiagnosticIssue) => void;
  viewRef: RefObject<EditorView | null>;
  activeFormats: Set<string>;
  canUndo?: boolean;
  canRedo?: boolean;
  onImagePicked: (files: File[]) => void;
  assetStatus: string | null;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  contextMenu?: ReactElement | undefined;
  previewContextMenu?: { onContextMenu: (event: MouseEvent<HTMLElement>) => void } | undefined;
  /** 是否启用软渲染（WYSIWYG），false = 源码模式 */
  softRender?: boolean;
  onLinkAction?: MarkdownPreviewProps["onLinkAction"] | undefined;
  onLinkInput?: () => void;
  /** 专注模式隐藏格式栏与大纲，并把纯源码列宽收进阅读区。 */
  focusMode?: boolean;
}

/** Markdown 编辑器主体：大纲 + 格式工具栏 + 编辑/分栏/预览三模式（P0-2） */
export function MarkdownEditorSurface({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, diagnostics, diagnosticsOpen, onDiagnosticsToggle, onDiagnosticsSelect, viewRef, activeFormats, canUndo = false, canRedo = false, onImagePicked, assetStatus, onContextMenu, contextMenu, previewContextMenu, softRender = true, onLinkAction, onLinkInput, focusMode = false }: MarkdownEditorSurfaceProps) {
  return (
    <>
      {mode !== "preview" && !focusMode ? <FormatToolbar viewRef={viewRef} active={activeFormats} canUndo={canUndo} canRedo={canRedo} onLinkInput={onLinkInput} onImagePicked={onImagePicked} status={assetStatus} diagnostics={diagnostics} diagnosticsOpen={diagnosticsOpen} onDiagnosticsToggle={onDiagnosticsToggle} onDiagnosticsSelect={onDiagnosticsSelect} /> : null}
      <EditorBody mode={mode} noteTheme={noteTheme} repoPath={repoPath} draft={draft} onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} previewRef={previewRef} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} ratio={ratio} onRatioChange={onRatioChange} outline={outline} outlineOpen={outlineOpen} onOutlineToggle={onOutlineToggle} onOutlineSelect={onOutlineSelect} softRender={softRender} onContextMenu={onContextMenu} previewContextMenu={previewContextMenu} onLinkAction={onLinkAction} focusMode={focusMode} />
      {contextMenu}
    </>
  );
}

interface EditorBodyProps {
  mode: ViewMode;
  noteTheme: NoteTheme;
  repoPath: string | null;
  draft: string;
  onChange: (value: string) => void;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
  previewRef: RefObject<HTMLDivElement | null>;
  onOpenWiki: (name: string) => void;
  wikiNotes: NoteWikiDto[];
  ratio: number;
  onRatioChange: (ratio: number) => void;
  outline: OutlineItem[];
  outlineOpen: boolean;
  onOutlineToggle: () => void;
  onOutlineSelect: (item: OutlineItem) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  softRender: boolean;
  previewContextMenu?: { onContextMenu: (event: MouseEvent<HTMLElement>) => void } | undefined;
  onLinkAction?: MarkdownPreviewProps["onLinkAction"];
  focusMode: boolean;
}

function EditorBody({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, softRender, onContextMenu, previewContextMenu, onLinkAction, focusMode }: EditorBodyProps) {
  const stableOnChange = useStableCallback(onChange);
  const editor = <EditorShell softRender={softRender} focusMode={focusMode}><CodeMirror className={softRender ? "cm-soft-render h-full" : "h-full"} value={draft} theme="none" basicSetup={focusMode ? FOCUS_BASIC_SETUP : softRender ? SOFT_RENDER_BASIC_SETUP : SOURCE_BASIC_SETUP} onChange={stableOnChange} extensions={extensions} onCreateEditor={onCreateEditor} /></EditorShell>;
  const outlineFloat = <NoteOutlineFloating items={outline} open={outlineOpen} onToggle={onOutlineToggle} onSelect={onOutlineSelect} />;
  if (mode === "split") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" onContextMenu={onContextMenu}>
        {focusMode ? null : outlineFloat}
    <SplitPane ratio={ratio} onRatioChange={onRatioChange} left={editor} right={<PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} {...previewContextMenu} onLinkAction={onLinkAction} />} />
      </div>
    );
  }
  if (mode === "preview") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" onContextMenu={onContextMenu}>
        {focusMode ? null : outlineFloat}
        <PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} {...previewContextMenu} onLinkAction={onLinkAction} />
      </div>
    );
  }
  return (
    <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" onContextMenu={onContextMenu}>
      {focusMode ? null : outlineFloat}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{editor}</div>
    </div>
  );
}

interface PreviewPaneProps {
  previewRef: RefObject<HTMLDivElement | null>;
  content: string;
  repoPath: string | null;
  onOpenWiki: (name: string) => void;
  wikiNotes: NoteWikiDto[];
  onChange: (content: string) => void;
  onContextMenu?: ((event: MouseEvent<HTMLElement>) => void) | undefined;
  onLinkAction?: MarkdownPreviewProps["onLinkAction"];
}

function PreviewPane({ previewRef, content, repoPath, onOpenWiki, wikiNotes, onChange, onContextMenu, onLinkAction }: PreviewPaneProps) {
  const debouncedContent = useDebouncedValue(content, PREVIEW_DEBOUNCE_MS);
  return <div ref={previewRef} className="note-preview-pane h-full min-h-0 flex-1 overflow-y-auto p-6" onContextMenu={onContextMenu}><Suspense fallback={<PreviewLoading />}><LazyMarkdownPreview content={debouncedContent} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} onLinkAction={onLinkAction} /></Suspense></div>;
}

function PreviewLoading() {
  return <div className="mx-auto h-full max-w-3xl animate-pulse bg-bg-primary/20" aria-busy="true" />;
}

function EditorShell({ softRender, focusMode, children }: { softRender: boolean; focusMode: boolean; children: React.ReactNode }) {
  return <div className={`${softRender ? "cm-soft-render-shell" : ""} ${focusMode ? "focus-editor-shell" : ""} h-full`}>{children}</div>;
}

/** 稳定回调引用：onChange 引用变化会触发 CodeMirror 重建全部扩展，进而打断鼠标选择。 */
function useStableCallback(callback: (value: string) => void): (value: string) => void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  return useCallback((value: string) => ref.current(value), []);
}
