import { markdown } from "@codemirror/lang-markdown";
import CodeMirror from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useNoteEditor, type NoteEditorHandle } from "../hooks/useNoteEditor";
import { useFocusTitleOnLoad } from "../hooks/useEditorFocus";
import { MarkdownPreview } from "./MarkdownPreview";

export type { NoteEditorHandle } from "../hooks/useNoteEditor";

type ViewMode = "edit" | "preview";

interface NoteEditorProps {
  repoPath: string | null;
  notePath: string | null;
  onMove: (from: string) => void;
  /** 新建打开时自动聚焦首行标题（P2） */
  focusTitleOnLoad?: boolean;
}

/** 笔记编辑器：编辑/预览双模式 + 防抖自动保存（P0-2） */
export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor({ repoPath, notePath, onMove, focusTitleOnLoad = false }, ref) {
    const { draft, onChange, flush, saving, dirty, error } = useNoteEditor(repoPath, notePath);
    const [mode, setMode] = useState<ViewMode>("edit");
    const { onCreateEditor } = useFocusTitleOnLoad(focusTitleOnLoad, notePath, draft);

    useImperativeHandle(ref, () => ({ flush }), [flush]);

    if (!notePath) return <EmptyState />;
    if (error) return <ErrorState message={error.message} />;

    return (
      <div className="flex h-full flex-col">
        <EditorToolbar
          path={notePath}
          mode={mode}
          saving={saving}
          dirty={dirty}
          onModeChange={setMode}
          onSave={flush}
          onMove={() => onMove(notePath)}
        />
        {mode === "edit" ? (
          <CodeMirror
            className="h-full min-h-0 flex-1"
            value={draft}
            onChange={onChange}
            extensions={[markdown()]}
            onCreateEditor={onCreateEditor}
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <MarkdownPreview content={draft} />
          </div>
        )}
      </div>
    );
  }
);

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  saving: boolean;
  dirty: boolean;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onMove: () => void;
}

function EditorToolbar({
  path,
  mode,
  saving,
  dirty,
  onModeChange,
  onSave,
  onMove,
}: EditorToolbarProps) {
  const status = saving ? "保存中…" : dirty ? "未保存" : "已保存";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bg-secondary px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium">{path}</span>
        <span className={`shrink-0 text-xs ${saving || dirty ? "text-warning" : "text-success"}`}>
          {status}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ModeTabs mode={mode} onChange={onModeChange} />
        <Button variant="ghost" onClick={onMove}>
          重命名
        </Button>
        <Button variant="ghost" onClick={onSave} disabled={saving || !dirty}>
          保存
        </Button>
      </div>
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const tabClass = (active: boolean) =>
    `px-2 py-1 ${active ? "bg-accent text-white" : "text-text-secondary"}`;
  return (
    <div className="flex overflow-hidden rounded-md border border-bg-secondary text-xs">
      <button className={tabClass(mode === "edit")} onClick={() => onChange("edit")}>
        编辑
      </button>
      <button className={tabClass(mode === "preview")} onClick={() => onChange("preview")}>
        预览
      </button>
    </div>
  );
}

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
