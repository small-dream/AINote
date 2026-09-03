import { useTranslation } from "@/i18n";
import type { DirectoryOption } from "../utils/directoryTree";

interface MoveDirectoryTreeProps {
  directories: DirectoryOption[];
  isLoading: boolean;
  selectedDir: string;
  onSelect: (path: string) => void;
}

/** 移动笔记弹窗中的目标目录树 */
export function MoveDirectoryTree({ directories, isLoading, selectedDir, onSelect }: MoveDirectoryTreeProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return <p className="mb-3 text-sm text-text-secondary">{t("common.loading")}</p>;
  }

  return (
    <div className="mb-3 max-h-64 overflow-y-auto rounded-md border border-border p-1" role="tree">
      {directories.map((directory) => (
        <DirectoryOptionButton
          key={directory.path || "root"}
          directory={directory}
          selected={directory.path === selectedDir}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function DirectoryOptionButton({ directory, selected, onSelect }: {
  directory: DirectoryOption;
  selected: boolean;
  onSelect: (path: string) => void;
}) {
  const { t } = useTranslation();
  const name = directory.path ? directory.name : t("tree.allNotes");
  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={selected}
      className={`mb-0.5 flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors ${selected ? "bg-accent/10 text-accent" : "text-text-primary hover:bg-bg-tertiary"}`}
      style={{ paddingLeft: `${directory.depth * 14 + 8}px` }}
      onClick={() => onSelect(directory.path)}
    >
      {name}
    </button>
  );
}
