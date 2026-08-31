import { useMemo } from "react";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import type { CommandPaletteActions } from "../types";
import { filterCommands, searchResultToCommand, type PaletteCommand } from "../utils/palette";
import { usePaletteCommands } from "./usePaletteCommands";
import { usePaletteSearch } from "./usePaletteSearch";

/** 命令面板编排：搜索结果与动作命令合并 + 键盘导航 + 选择态（View 层零逻辑） */
export function useCommandPalette(repoPath: string | null, actions: CommandPaletteActions) {
  const open = useCommandPaletteStore((state) => state.open);
  const query = useCommandPaletteStore((state) => state.query);
  const selected = useCommandPaletteStore((state) => state.selected);
  const setQuery = useCommandPaletteStore((state) => state.setQuery);
  const moveSelection = useCommandPaletteStore((state) => state.moveSelection);
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const actionCommands = usePaletteCommands(actions);
  const { results, isSearching } = usePaletteSearch(open, repoPath);

  const commands = useMemo<PaletteCommand[]>(() => {
    const trimmed = query.trim();
    const searchCommands = trimmed
      ? results.map((result) => searchResultToCommand(result, actions.onOpenNote, closePalette))
      : [];
    return [...searchCommands, ...filterCommands(actionCommands, trimmed)];
  }, [results, actionCommands, query, actions, closePalette]);

  const safeSelected = Math.min(selected, Math.max(commands.length - 1, 0));

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1, commands.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1, commands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commands[safeSelected]?.run();
    } else if (event.key === "Escape") {
      closePalette();
    }
  }

  return { open, query, setQuery, commands, selected: safeSelected, isSearching, handleKeyDown, closePalette };
}
