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
import { useLongPressContextMenu } from "@/hooks/useLongPressContextMenu";

/** 预览渲染防抖窗口：击键后延迟重跑 Markdown 管线（与 3s 落盘防抖 AUTOSAVE_DEBOUNCE_MS 解耦）。 */
export const PREVIEW_DEBOUNCE_MS = 250;

const LazyMarkdownPreview = lazy(() => import("./MarkdownPreview").then(({ MarkdownPreview }) => ({ default: MarkdownPreview })));

/** CodeMirror 基础扩展配置：模块级常量，避免每次渲染生成新对象导致 @uiw/react-codemirror 重建全部扩展。 */
const SOURCE_BASIC_SETUP = { syntaxHighlighting: true, lineNumbers: true, highlightActiveLine: true, highlightActiveLineGutter: true, foldGutter: false };
const SOFT_RENDER_BASIC_SETUP = { syntaxHighlighting: false, lineNumbers: false, highlightActiveLine: false, highlightActiveLineGutter: false, foldGutter: false };

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
  onImagePicked: (files: File[]) => void;
  assetStatus: string | null;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onLongPress?: ((point: { x: number; y: number }) => void) | undefined;
  contextMenu?: ReactElement | undefined;
  previewContextMenu?: { onContextMenu: (event: MouseEvent<HTMLElement>) => void; onLongPress?: ((point: { x: number; y: number }) => void) | undefined } | undefined;
  /** 是否启用软渲染（WYSIWYG），false = 源码模式 */
  softRender?: boolean;
}

/** Markdown 编辑器主体：大纲 + 格式工具栏 + 编辑/分栏/预览三模式（P0-2） */
export function MarkdownEditorSurface({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, diagnostics, diagnosticsOpen, onDiagnosticsToggle, onDiagnosticsSelect, viewRef, activeFormats, onImagePicked, assetStatus, onContextMenu, onLongPress, contextMenu, previewContextMenu, softRender = true }: MarkdownEditorSurfaceProps) {
  return (
    <>
      {mode !== "preview" ? <FormatToolbar viewRef={viewRef} active={activeFormats} onImagePicked={onImagePicked} status={assetStatus} diagnostics={diagnostics} diagnosticsOpen={diagnosticsOpen} onDiagnosticsToggle={onDiagnosticsToggle} onDiagnosticsSelect={onDiagnosticsSelect} /> : null}
      <EditorBody mode={mode} noteTheme={noteTheme} repoPath={repoPath} draft={draft} onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} previewRef={previewRef} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} ratio={ratio} onRatioChange={onRatioChange} outline={outline} outlineOpen={outlineOpen} onOutlineToggle={onOutlineToggle} onOutlineSelect={onOutlineSelect} softRender={softRender} onContextMenu={onContextMenu} onLongPress={onLongPress} previewContextMenu={previewContextMenu} />
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
  onLongPress?: ((point: { x: number; y: number }) => void) | undefined;
  softRender: boolean;
  previewContextMenu?: { onContextMenu: (event: MouseEvent<HTMLElement>) => void; onLongPress?: ((point: { x: number; y: number }) => void) | undefined } | undefined;
}

function EditorBody({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, softRender, onContextMenu, onLongPress, previewContextMenu }: EditorBodyProps) {
  const longPressProps = useLongPressContextMenu(onLongPress ?? (() => undefined));
  const stableOnChange = useStableCallback(onChange);
  const editor = <EditorShell softRender={softRender}><CodeMirror className={softRender ? "cm-soft-render h-full" : "h-full"} value={draft} theme="none" basicSetup={softRender ? SOFT_RENDER_BASIC_SETUP : SOURCE_BASIC_SETUP} onChange={stableOnChange} extensions={extensions} onCreateEditor={onCreateEditor} /></EditorShell>;
  const outlineFloat = <NoteOutlineFloating items={outline} open={outlineOpen} onToggle={onOutlineToggle} onSelect={onOutlineSelect} />;
  if (mode === "split") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" {...longPressProps} onContextMenu={onContextMenu}>
        {outlineFloat}
        <SplitPane ratio={ratio} onRatioChange={onRatioChange} left={editor} right={<PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} {...previewContextMenu} />} />
      </div>
    );
  }
  if (mode === "preview") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" {...longPressProps} onContextMenu={onContextMenu}>
        {outlineFloat}
        <PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} {...previewContextMenu} />
      </div>
    );
  }
  return (
    <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden" {...longPressProps} onContextMenu={onContextMenu}>
      {outlineFloat}
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
  onLongPress?: ((point: { x: number; y: number }) => void) | undefined;
}

function PreviewPane({ previewRef, content, repoPath, onOpenWiki, wikiNotes, onChange, onContextMenu, onLongPress }: PreviewPaneProps) {
  const debouncedContent = useDebouncedValue(content, PREVIEW_DEBOUNCE_MS);
  const longPressProps = useLongPressContextMenu(onLongPress ?? (() => undefined), { stopPropagation: Boolean(onLongPress) });
  return <div ref={previewRef} className="note-preview-pane h-full min-h-0 flex-1 overflow-y-auto p-6" {...longPressProps} onContextMenu={onContextMenu}><Suspense fallback={<PreviewLoading />}><LazyMarkdownPreview content={debouncedContent} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} /></Suspense></div>;
}

function PreviewLoading() {
  return <div className="mx-auto h-full max-w-3xl animate-pulse bg-bg-primary/20" aria-busy="true" />;
}

function EditorShell({ softRender, children }: { softRender: boolean; children: React.ReactNode }) {
  return <div className={softRender ? "cm-soft-render-shell h-full" : "h-full"}>{children}</div>;
}

/** 稳定回调引用：onChange 引用变化会触发 CodeMirror 重建全部扩展，进而打断鼠标选择。 */
function useStableCallback(callback: (value: string) => void): (value: string) => void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  return useCallback((value: string) => ref.current(value), []);
}
