import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useNoteHistory } from "@/features/history/hooks/useNoteHistory";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { useEditorViewReady } from "../hooks/useEditorViewReady";
import { useSyncScroll } from "../hooks/useSyncScroll";
import { useAssetImport } from "@/features/asset/hooks/useAssetImport";
import { HistoryPanel } from "@/features/history/components/HistoryPanel";
import { EditorToolbar, type ViewMode } from "./EditorToolbar";
import { FormatToolbar } from "./FormatToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { SplitPane } from "./SplitPane";
import { useTranslation } from "@/i18n";

export type { NoteEditorHandle } from "../hooks/useNoteEditor";

interface NoteEditorProps {
  repoPath: string | null;
  notePath: string | null;
  onMove: (from: string) => void;
  /** 新建打开时自动聚焦首行标题（P2） */
  focusTitleOnLoad?: boolean;
}

/** 笔记编辑器：格式工具栏 + 编辑/分栏/预览三模式 + 防抖自动保存（P0-2） */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ repoPath, notePath, onMove, focusTitleOnLoad = false }, ref) {
    const history = useNoteHistory();
    const [mode, setMode] = useState<ViewMode>("edit");
    const { draft, onChange, flush, saving, dirty, error } = useNoteEditor(repoPath, notePath, history.reloadEpoch);
    const { onCreateEditor, viewRef } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);
    const { extensions, activeFormats } = useEditorExtensions();
    const { readyView, handleCreateEditor } = useEditorViewReady(onCreateEditor);
    const asset = useAssetImport(readyView);
    const previewRef = useRef<HTMLDivElement | null>(null);
    useSyncScroll(readyView, previewRef, mode);
    useImperativeHandle(ref, () => ({ flush }), [flush]);

    if (!notePath) return <EmptyState />;
    if (error) return <ErrorState message={error.message} />;

    return (
      <div className="flex h-full min-h-0 flex-col bg-bg-primary">
        <EditorToolbar path={notePath} mode={mode} saving={saving} dirty={dirty} onModeChange={setMode} onSave={flush} onMove={() => onMove(notePath)} onHistory={history.openHistory} />
        {mode !== "preview" && <FormatToolbar viewRef={viewRef} active={activeFormats} onImagePicked={asset.handleFiles} status={asset.status} />}
        <EditorBody mode={mode} repoPath={repoPath} draft={draft} onChange={onChange} extensions={extensions} onCreateEditor={handleCreateEditor} previewRef={previewRef} />
        <HistoryPanel repoPath={repoPath} path={notePath} open={history.open} onClose={history.closeHistory} onRestored={history.onRestored} />
      </div>
    );
  }
);

interface EditorBodyProps {
  mode: ViewMode;
  repoPath: string | null;
  draft: string;
  onChange: (value: string) => void;
  extensions: Extension[];
  onCreateEditor: (view: EditorView) => void;
  previewRef: RefObject<HTMLDivElement | null>;
}

function EditorBody({
  mode,
  repoPath,
  draft,
  onChange,
  extensions,
  onCreateEditor,
  previewRef,
}: EditorBodyProps) {
  const editor = (
    <CodeMirror
      className="h-full"
      value={draft}
      theme="none"
      onChange={onChange}
      extensions={extensions}
      onCreateEditor={onCreateEditor}
    />
  );
  if (mode === "split") {
    return (
      <SplitPane
        left={editor}
        right={
          <div ref={previewRef} className="h-full overflow-y-auto p-6">
            <MarkdownPreview content={draft} repoPath={repoPath} />
          </div>
        }
      />
    );
  }
  if (mode === "preview") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <MarkdownPreview content={draft} repoPath={repoPath} />
      </div>
    );
  }
  return <div className="min-h-0 flex-1 overflow-hidden">{editor}</div>;
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
