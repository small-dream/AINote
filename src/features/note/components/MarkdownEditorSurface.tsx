import type { Extension } from "@codemirror/state";
import { lazy, Suspense, type RefObject } from "react";
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

const LazyMarkdownPreview = lazy(() => import("./MarkdownPreview").then(({ MarkdownPreview }) => ({ default: MarkdownPreview })));

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
  /** 是否启用软渲染（WYSIWYG），false = 源码模式 */
  softRender?: boolean;
}

/** Markdown 编辑器主体：大纲 + 格式工具栏 + 编辑/分栏/预览三模式（P0-2） */
export function MarkdownEditorSurface({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, diagnostics, diagnosticsOpen, onDiagnosticsToggle, onDiagnosticsSelect, viewRef, activeFormats, onImagePicked, assetStatus, softRender = true }: MarkdownEditorSurfaceProps) {
  return (
    <>
      {mode !== "preview" ? <FormatToolbar viewRef={viewRef} active={activeFormats} onImagePicked={onImagePicked} status={assetStatus} diagnostics={diagnostics} diagnosticsOpen={diagnosticsOpen} onDiagnosticsToggle={onDiagnosticsToggle} onDiagnosticsSelect={onDiagnosticsSelect} /> : null}
      <EditorBody mode={mode} noteTheme={noteTheme} repoPath={repoPath} draft={draft} onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} previewRef={previewRef} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} ratio={ratio} onRatioChange={onRatioChange} outline={outline} outlineOpen={outlineOpen} onOutlineToggle={onOutlineToggle} onOutlineSelect={onOutlineSelect} softRender={softRender} />
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
  softRender: boolean;
}

function EditorBody({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineToggle, onOutlineSelect, softRender }: EditorBodyProps) {
  const editor = <EditorShell softRender={softRender}><CodeMirror className={softRender ? "cm-soft-render h-full" : "h-full"} value={draft} theme="none" basicSetup={{ syntaxHighlighting: !softRender, lineNumbers: !softRender, highlightActiveLineGutter: !softRender, foldGutter: false }} onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} /></EditorShell>;
  const outlineFloat = <NoteOutlineFloating items={outline} open={outlineOpen} onToggle={onOutlineToggle} onSelect={onOutlineSelect} />;
  if (mode === "split") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden">
        {outlineFloat}
        <SplitPane ratio={ratio} onRatioChange={onRatioChange} left={editor} right={<PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} />} />
      </div>
    );
  }
  if (mode === "preview") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden">
        {outlineFloat}
        <PreviewPane previewRef={previewRef} content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} />
      </div>
    );
  }
  return (
    <div data-note-theme={noteTheme} className="note-theme-surface relative flex min-h-0 flex-1 overflow-hidden">
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
}

function PreviewPane({ previewRef, content, repoPath, onOpenWiki, wikiNotes, onChange }: PreviewPaneProps) {
  return <div ref={previewRef} className="note-preview-pane h-full min-h-0 flex-1 overflow-y-auto p-6"><Suspense fallback={<PreviewLoading />}><LazyMarkdownPreview content={content} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} onChange={onChange} /></Suspense></div>;
}

function PreviewLoading() {
  return <div className="mx-auto h-full max-w-3xl animate-pulse bg-bg-primary/20" aria-busy="true" />;
}

function EditorShell({ softRender, children }: { softRender: boolean; children: React.ReactNode }) {
  return <div className={softRender ? "cm-soft-render-shell h-full" : "h-full"}>{children}</div>;
}
