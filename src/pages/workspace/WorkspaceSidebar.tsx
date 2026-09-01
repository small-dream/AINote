import { FileTree } from "@/features/file-tree/components/FileTree";
import { TagIndex } from "@/features/wiki/components/TagIndex";
import { TrashPanel } from "@/features/trash/components/TrashPanel";
import { useTranslation } from "@/i18n";
import { useUiStore, type SidebarTab } from "@/stores/ui.store";

interface WorkspaceSidebarProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string) => void;
  onRequestFolder: (dir: string) => void;
  onRequestMove: (path: string) => void;
}

const TABS: { key: SidebarTab; labelKey: "tree.label" | "wiki.tags" | "trash.title" }[] = [
  { key: "tree", labelKey: "tree.label" },
  { key: "tags", labelKey: "wiki.tags" },
  { key: "trash", labelKey: "trash.title" },
];

/** 侧边栏：目录树 / 标签索引切换（P0-3 / P1-5） */
export function WorkspaceSidebar({
  repoPath,
  onSelect,
  onRequestNew,
  onRequestFolder,
  onRequestMove,
}: WorkspaceSidebarProps) {
  const tab = useUiStore((s) => s.sidebarTab);
  const setTab = useUiStore((s) => s.setSidebarTab);
  return (
    <div className="flex min-h-0 w-[248px] shrink-0 flex-col border-r border-border bg-bg-secondary/80">
      <SidebarTabs tab={tab} onChange={setTab} />
      {tab === "tree" ? (
        <FileTree repoPath={repoPath} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestMove={onRequestMove} />
      ) : tab === "tags" ? (
        <TagIndex repoPath={repoPath} onSelect={onSelect} />
      ) : (
        <TrashPanel repoPath={repoPath} onSelect={onSelect} />
      )}
    </div>
  );
}

function SidebarTabs({ tab, onChange }: { tab: SidebarTab; onChange: (tab: SidebarTab) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 border-b border-border">
      {TABS.map(({ key, labelKey }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === key
              ? "border-b-2 border-accent text-accent"
              : "border-b-2 border-transparent text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}
