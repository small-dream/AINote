import { Button } from "@/components/atoms/Button";

export type ViewMode = "edit" | "split" | "preview";

interface EditorToolbarProps {
  path: string;
  mode: ViewMode;
  saving: boolean;
  dirty: boolean;
  onModeChange: (mode: ViewMode) => void;
  onSave: () => void;
  onMove: () => void;
}

const MODE_TABS: { key: ViewMode; label: string }[] = [
  { key: "edit", label: "编辑" },
  { key: "split", label: "分栏" },
  { key: "preview", label: "预览" },
];

/** 编辑器顶部工具栏：文件名 + 保存状态 + 模式切换 + 操作按钮 */
export function EditorToolbar({
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
    <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-semibold">{path.split("/").at(-1)}</span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${saving || dirty ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
          {status}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ModeTabs mode={mode} onChange={onModeChange} />
        <Button variant="ghost" className="text-xs" onClick={onMove}>
          移动 / 重命名
        </Button>
        <Button variant="primary" className="text-xs" onClick={onSave} disabled={saving || !dirty}>
          保存
        </Button>
      </div>
    </div>
  );
}

function ModeTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const tabClass = (active: boolean) =>
    `px-3 py-1.5 transition-colors ${active ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-tertiary"}`;
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-bg-secondary text-xs">
      {MODE_TABS.map((tab) => (
        <button key={tab.key} className={tabClass(mode === tab.key)} onClick={() => onChange(tab.key)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
