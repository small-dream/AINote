import { useEffect, useRef } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useCommandPalette } from "../hooks/useCommandPalette";
import { usePaletteShortcut } from "../hooks/usePaletteShortcut";
import type { CommandPaletteActions } from "../types";
import type { PaletteCommand } from "../utils/palette";

interface CommandPaletteProps {
  repoPath: string | null;
  actions: CommandPaletteActions;
}

/** Cmd+K 命令面板：输入即全文搜索，回车执行选中命令（纯渲染，逻辑在 hooks） */
export function CommandPalette({ repoPath, actions }: CommandPaletteProps) {
  usePaletteShortcut();
  const { t } = useTranslation();
  const { open, query, setQuery, commands, selected, isSearching, handleKeyDown, closePalette } =
    useCommandPalette(repoPath, actions);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;
  const hasQuery = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={t("palette.title")} className="w-full max-w-xl overflow-hidden rounded-xl bg-bg-primary shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-text-tertiary" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("palette.placeholder")}
            aria-label={t("palette.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
          <kbd className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-text-tertiary">ESC</kbd>
        </div>
        <PaletteList commands={commands} selected={selected} isSearching={isSearching} hasQuery={hasQuery} />
        <PaletteFooter />
      </div>
    </div>
  );
}

interface PaletteListProps {
  commands: PaletteCommand[];
  selected: number;
  isSearching: boolean;
  hasQuery: boolean;
}

function PaletteList({ commands, selected, isSearching, hasQuery }: PaletteListProps) {
  const { t } = useTranslation();
  if (hasQuery && isSearching && commands.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-text-tertiary">{t("palette.searching")}</div>;
  }
  if (commands.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-text-tertiary">{t("palette.noResults")}</div>;
  }
  return (
    <ul className="max-h-[40vh] overflow-y-auto py-1" role="listbox">
      {commands.map((command, index) => (
        <PaletteItem
          key={command.id}
          command={command}
          selected={index === selected}
          onRun={() => command.run()}
        />
      ))}
    </ul>
  );
}

interface PaletteItemProps {
  command: PaletteCommand;
  selected: boolean;
  onRun: () => void;
}

function PaletteItem({ command, selected, onRun }: PaletteItemProps) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onRun}
        className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${selected ? "bg-bg-tertiary text-text-primary" : "text-text-secondary"}`}
      >
        <span className="min-w-0 truncate">{command.label}</span>
        {command.hint && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-text-tertiary">
            <CornerDownLeft size={12} aria-hidden="true" />
            <span className="max-w-48 truncate">{command.hint}</span>
          </span>
        )}
      </button>
    </li>
  );
}

function PaletteFooter() {
  const { t } = useTranslation();
  return (
    <div className="border-t border-border px-4 py-2 text-[11px] text-text-tertiary">
      {t("palette.nav")}
    </div>
  );
}
