import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { useEditorExtensions } from "../hooks/useEditorExtensions";
import { EditorToolbar, type ViewMode } from "./EditorToolbar";
import { FormatToolbar } from "./FormatToolbar";
import { MarkdownPreview } from "./MarkdownPreview";

export type { NoteEditorHandle } from "../hooks/useNoteEditor";

interface NoteEditorProps {
  repoPath: string | null;
  notePath: string | null;
  onMove: (from: string) => void;
  /** 新建打开时自动聚焦首行标题（P2） */
  focusTitleOnLoad?: boolean;
}

/** 笔记编辑器：格式工具栏 + 编辑/预览双模式 + 防抖自动保存（P0-2） */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ repoPath, notePath, onMove, focusTitleOnLoad = false }, ref) {
    const { draft, onChange, flush, saving, dirty, error } = useNoteEditor(repoPath, notePath);
    const [mode, setMode] = useState<ViewMode>("edit");
    const { onCreateEditor, viewRef } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);
    const { extensions, activeFormats } = useEditorExtensions();

    useImperativeHandle(ref, () => ({ flush }), [flush]);

    if (!notePath) return <EmptyState />;
    if (error) return <ErrorState message={error.message} />;

    return (
      <div className="flex h-full flex-col bg-bg-primary">
        <EditorToolbar
          path={notePath}
          mode={mode}
          saving={saving}
          dirty={dirty}
          onModeChange={setMode}
          onSave={flush}
          onMove={() => onMove(notePath)}
        />
        {mode === "edit" && <FormatToolbar viewRef={viewRef} active={activeFormats} />}
        {mode === "edit" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <CodeMirror
              className="h-full"
              value={draft}
              onChange={onChange}
              extensions={extensions}
              onCreateEditor={onCreateEditor}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <MarkdownPreview content={draft} />
          </div>
        )}
      </div>
    );
  }
);

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-text-secondary">
      选择或新建一篇笔记开始写作
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-danger">
      加载失败：{message}
    </div>
  );
}
