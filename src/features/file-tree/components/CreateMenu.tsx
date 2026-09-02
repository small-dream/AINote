import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FolderPlus, Import, NotebookPen, Plus, Type } from "lucide-react";
import type { NoteKind } from "@/api/types";
import { useTranslation } from "@/i18n";
import { useCreateMenu } from "../hooks/useCreateMenu";
import { useCreateMenuLayer } from "../hooks/useCreateMenuLayer";

interface CreateMenuProps {
  onCreateNote: (kind: NoteKind) => Promise<void>;
  onCreateFolder: () => void;
  onImportFiles: (files: File[]) => Promise<void>;
  compact?: boolean;
  className?: string;
}

/** 统一创建入口：笔记、文件和文件夹都从同一个 + 菜单进入。 */
export function CreateMenu({ onCreateNote, onCreateFolder, onImportFiles, compact = false, className = "" }: CreateMenuProps) {
  const { t } = useTranslation();
  const tooltip = compact ? t("tree.newHere") : t("create.open");
  const inputRef = useRef<HTMLInputElement>(null);
  const menu = useCreateMenu(onCreateNote, onImportFiles);
  const layer = useCreateMenuLayer(menu.open, menu.close);
  const { triggerRef, menuRef, position } = layer;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        aria-label={t("create.open")}
        title={tooltip}
        data-tooltip={tooltip}
        disabled={menu.busy}
        className={`tree-action tree-create-trigger flex items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-accent ${compact ? "h-7 w-7" : "h-8 w-8"}`}
        onClick={menu.toggle}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
      {menu.open && createPortal(
        <CreateMenuPanel menuRef={menuRef} position={position} menu={menu} inputRef={inputRef} onCreateFolder={onCreateFolder} markdownLabel={t("create.markdown")} richTextLabel={t("create.richText")} folderLabel={t("create.folder")} importLabel={t("create.importFile")} importHint={t("create.importHint")} />,
        document.body,
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          void menu.importFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}

function CreateMenuPanel({ menuRef, position, menu, inputRef, onCreateFolder, markdownLabel, richTextLabel, folderLabel, importLabel, importHint }: { menuRef: RefObject<HTMLDivElement | null>; position: CSSProperties; menu: ReturnType<typeof useCreateMenu>; inputRef: RefObject<HTMLInputElement | null>; onCreateFolder: () => void; markdownLabel: string; richTextLabel: string; folderLabel: string; importLabel: string; importHint: string }) {
  return (
    <div ref={menuRef} role="menu" className="fixed z-50 w-64 rounded-lg border border-border bg-bg-primary p-1.5 shadow-lg" style={position}>
      <CreateAction icon={<NotebookPen size={16} />} label={markdownLabel} hint=".md" onClick={() => void menu.createNote("markdown")} disabled={menu.busy} />
      <CreateAction icon={<Type size={16} />} label={richTextLabel} hint=".ainote" onClick={() => void menu.createNote("richText")} disabled={menu.busy} />
      <CreateAction icon={<Import size={16} />} label={importLabel} hint={importHint} onClick={() => inputRef.current?.click()} disabled={menu.busy} />
      <CreateAction icon={<FolderPlus size={16} />} label={folderLabel} hint="" onClick={() => { menu.close(); onCreateFolder(); }} disabled={menu.busy} />
      {menu.error && <p className="px-2 py-1 text-xs text-danger" role="alert">{menu.error}</p>}
    </div>
  );
}

function CreateAction({ icon, label, hint, onClick, disabled }: { icon: ReactNode; label: string; hint: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" disabled={disabled} className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary disabled:opacity-50" onClick={onClick}>
      <span className="text-accent" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-text-tertiary">{hint}</span>}
    </button>
  );
}
