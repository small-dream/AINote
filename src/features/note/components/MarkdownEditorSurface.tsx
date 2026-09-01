import type { Extension } from "@codemirror/state";
import type { RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import type { NoteWikiDto } from "@/api/types";
import CodeMirror from "@uiw/react-codemirror";
import { MarkdownPreview } from "./MarkdownPreview";
import { SplitPane } from "./SplitPane";
import { NoteOutline } from "./NoteOutline";
import { FormatToolbar } from "./FormatToolbar";
import type { ViewMode } from "./EditorToolbar";
import type { OutlineItem } from "../utils/outline";
import type { NoteTheme } from "@/stores/ui.store";

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
  onOutlineSelect: (item: OutlineItem) => void;
  viewRef: RefObject<EditorView | null>;
  activeFormats: Set<string>;
  onImagePicked: (files: File[]) => void;
  assetStatus: string | null;
}

/** Markdown 编辑器主体：大纲 + 格式工具栏 + 编辑/分栏/预览三模式（P0-2） */
export function MarkdownEditorSurface({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange, outline, outlineOpen, onOutlineSelect, viewRef, activeFormats, onImagePicked, assetStatus }: MarkdownEditorSurfaceProps) {
  return (
    <>
      {outlineOpen ? <NoteOutline items={outline} onSelect={onOutlineSelect} /> : null}
      {mode !== "preview" ? <FormatToolbar viewRef={viewRef} active={activeFormats} onImagePicked={onImagePicked} status={assetStatus} /> : null}
      <EditorBody mode={mode} noteTheme={noteTheme} repoPath={repoPath} draft={draft} onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} previewRef={previewRef} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} ratio={ratio} onRatioChange={onRatioChange} />
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
}

function EditorBody({ mode, noteTheme, repoPath, draft, onChange, extensions, onCreateEditor, previewRef, onOpenWiki, wikiNotes, ratio, onRatioChange }: EditorBodyProps) {
  const editor = <CodeMirror className="h-full" value={draft} theme="none" onChange={onChange} extensions={extensions} onCreateEditor={onCreateEditor} />;
  if (mode === "split") {
    return (
      <div data-note-theme={noteTheme} className="note-theme-surface min-h-0 flex-1 overflow-hidden">
        <SplitPane ratio={ratio} onRatioChange={onRatioChange} left={editor} right={<div ref={previewRef} className="note-preview-pane h-full overflow-y-auto p-6"><MarkdownPreview content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} /></div>} />
      </div>
    );
  }
  if (mode === "preview") {
    return <div ref={previewRef} data-note-theme={noteTheme} className="note-theme-surface note-preview-pane min-h-0 flex-1 overflow-y-auto p-6"><MarkdownPreview content={draft} repoPath={repoPath} onOpenWiki={onOpenWiki} wikiNotes={wikiNotes} /></div>;
  }
  return <div data-note-theme={noteTheme} className="note-theme-surface min-h-0 flex-1 overflow-hidden">{editor}</div>;
}
