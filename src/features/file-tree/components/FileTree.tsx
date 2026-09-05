import type { ComponentProps } from "react";
import { useState } from "react";
import type { SearchResult, TreeNode } from "@/api/types";
import type { NoteKind } from "@/api/types";
import { messageOf } from "@/api";
import { useDeleteNoteMutation } from "@/queries/note.queries";
import { useDeleteFolderMutation } from "@/queries/tree.queries";
import { useFavoriteNotesQuery, useToggleFavoriteMutation } from "@/queries/favorite.queries";
import { useSessionStore } from "@/stores/session.store";
import { useFileTree } from "../hooks/useFileTree";
import { useTreeSearch } from "../hooks/useTreeSearch";
import { useTreeContextMenu } from "../hooks/useTreeContextMenu";
import { TreeContextMenu as TreeContextMenuView } from "./TreeContextMenu";
import { DeleteConfirmDialog, type PendingDelete } from "./DeleteConfirmDialog";
import { useTranslation } from "@/i18n";
import { CreateMenu } from "./CreateMenu";
import { TreeSearchInput, TreeSearchResults } from "./TreeSearch";
import { TreeNodes } from "./TreeNodes";
import { favoritePathsOf } from "@/features/favorites/utils/favorites";

interface FileTreeProps {
  repoPath: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onRequestImportNotes: (dir: string, files: File[]) => Promise<void>;
  createDir?: string;
  onRequestMove: (path: string) => void;
  onRequestRename: (path: string) => void;
  onRequestHistory: (path: string) => void;
}

/** 目录树（P0-3）：目录可折叠、可在目录内新建笔记/文件夹；文件点击打开 */
export function FileTree({ repoPath, onSelect, onRequestNew, onRequestFolder, onRequestImport, onRequestImportNotes, createDir = "", onRequestMove, onRequestRename, onRequestHistory }: FileTreeProps) {
  const { t } = useTranslation();
  const { tree, isLoading, expanded, toggle } = useFileTree(repoPath);
  const { data: favorites = [] } = useFavoriteNotesQuery(repoPath);
  const toggleFavorite = useToggleFavoriteMutation();
  const [query, setQuery] = useState("");
  const { results, isSearching, error } = useTreeSearch(repoPath, query);

  if (isLoading || !tree) {
    return <div className="p-4 text-sm text-text-secondary">{t("common.loading")}</div>;
  }

  return (
    <TreeContent
      tree={tree}
      expanded={expanded}
      toggle={toggle}
      query={query}
      onQueryChange={setQuery}
      results={results}
      isSearching={isSearching}
      error={error}
      onSelect={onSelect}
      onRequestNew={onRequestNew}
      onRequestFolder={onRequestFolder}
      onRequestImport={onRequestImport}
      onRequestImportNotes={onRequestImportNotes}
      createDir={createDir}
      onRequestMove={onRequestMove}
      onRequestRename={onRequestRename}
      onRequestHistory={onRequestHistory}
      favoritePaths={favoritePathsOf(favorites)}
      onToggleFavorite={toggleFavorite.mutate}
    />
  );
}

interface TreeContentProps {
  tree: TreeNode;
  expanded: Set<string>;
  toggle: (path: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  onSelect: (path: string) => void;
  onRequestNew: (dir: string, kind?: NoteKind) => void;
  onRequestFolder: (dir: string) => void;
  onRequestImport: (files: File[]) => Promise<void>;
  onRequestImportNotes: (dir: string, files: File[]) => Promise<void>;
  createDir: string;
  onRequestMove: (path: string) => void;
  onRequestRename: (path: string) => void;
  onRequestHistory: (path: string) => void;
  favoritePaths: Set<string>;
  onToggleFavorite: (path: string) => void;
}

function TreeContent({ tree, expanded, toggle, query, onQueryChange, results, isSearching, error, onSelect, onRequestNew, onRequestFolder, onRequestImport, onRequestImportNotes, createDir, onRequestMove, onRequestRename, onRequestHistory, favoritePaths, onToggleFavorite }: TreeContentProps) {
  const { t } = useTranslation();
  const currentNotePath = useSessionStore((s) => s.currentNotePath);
  const openNote = useSessionStore((s) => s.openNote);
  const remove = useDeleteNoteMutation((path) => { if (path === currentNotePath) openNote(null); });
  const removeFolder = useDeleteFolderMutation((path) => { if (currentNotePath && (currentNotePath === path || currentNotePath.startsWith(`${path}/`))) openNote(null); });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const contextMenu = useTreeContextMenu();
  const requestDelete = (path: string, isFolder: boolean) => { setDeleteError(null); setPendingDelete({ path, isFolder, name: contextMenu.menu?.node.name ?? path }); };
  const confirmDelete = async () => { if (!pendingDelete) return; try { if (pendingDelete.isFolder) await removeFolder.mutateAsync(pendingDelete.path); else await remove.mutateAsync(pendingDelete.path); setPendingDelete(null); } catch (error) { setDeleteError(messageOf(error)); } };
  const searching = query.trim().length > 0;
  return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <TreeToolbar createDir={createDir} query={query} onQueryChange={onQueryChange} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestImport={onRequestImport} onRequestImportNotes={onRequestImportNotes} />
    {searching ? (
      <TreeSearchResults query={query} results={results} isSearching={isSearching} error={error} onSelect={onSelect} />
    ) : (
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label={t("tree.navigation")}><TreeNodes node={tree} depth={0} expanded={expanded} currentNotePath={currentNotePath} onToggle={toggle} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestImport={onRequestImport} onRequestImportNotes={onRequestImportNotes} onContextMenu={contextMenu.open} /></nav>
    )}
    {deleteError && <div className="tree-error" role="alert">{t("tree.deleteFailed", { message: deleteError })}</div>}
    <ContextMenuSlot menu={contextMenu.menu} copied={contextMenu.copied} onClose={contextMenu.close} onToggle={toggle} onSelect={onSelect} onRequestNew={onRequestNew} onRequestFolder={onRequestFolder} onRequestMove={onRequestMove} onRequestRename={onRequestRename} onRequestHistory={onRequestHistory} onDelete={(path) => requestDelete(path, false)} onDeleteFolder={(path) => requestDelete(path, true)} onCopy={contextMenu.copy} favoritePaths={favoritePaths} onToggleFavorite={onToggleFavorite} />
    <DeleteConfirmDialog pending={pendingDelete} busy={remove.isPending || removeFolder.isPending} onClose={() => setPendingDelete(null)} onConfirm={confirmDelete} />
  </div>;
}

function TreeToolbar({ createDir, query, onQueryChange, onRequestNew, onRequestFolder, onRequestImport, onRequestImportNotes }: Pick<FileTreeProps, "onRequestNew" | "onRequestFolder" | "onRequestImport" | "onRequestImportNotes"> & { createDir: string; query: string; onQueryChange: (query: string) => void }) {
  return <div className="flex min-w-0 shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
    <TreeSearchInput value={query} onChange={onQueryChange} />
    <CreateMenu className="shrink-0" onCreateNote={async (kind: NoteKind) => { await onRequestNew(createDir, kind); }} onCreateFolder={() => onRequestFolder(createDir)} onImportFiles={onRequestImport} onImportNotes={(files) => onRequestImportNotes(createDir, files)} />
  </div>;
}

function ContextMenuSlot(props: Omit<ComponentProps<typeof TreeContextMenuView>, "menu"> & { menu: ComponentProps<typeof TreeContextMenuView>["menu"] | null }) {
  const { menu, ...rest } = props;
  return menu ? <TreeContextMenuView {...rest} menu={menu} /> : null;
}
