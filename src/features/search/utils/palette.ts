import type { SearchResult } from "@/api/types";

/** 命令面板可执行的单个命令（纯数据 + 执行回调） */
export interface PaletteCommand {
  id: string;
  label: string;
  /** 次要说明，如笔记路径 */
  hint?: string;
  keywords: string[];
  run: () => void;
}

export function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase();
}

export function commandMatches(command: PaletteCommand, query: string): boolean {
  const q = normalizeKeyword(query);
  if (!q) return true;
  if (normalizeKeyword(command.label).includes(q)) return true;
  return command.keywords.some((keyword) => normalizeKeyword(keyword).includes(q));
}

export function filterCommands(
  commands: readonly PaletteCommand[],
  query: string,
): PaletteCommand[] {
  return commands.filter((command) => commandMatches(command, query));
}

/** 把搜索结果包装成「打开笔记」命令 */
export function searchResultToCommand(
  result: SearchResult,
  onOpenNote: (path: string) => void,
  closePalette: () => void,
): PaletteCommand {
  return {
    id: `note:${result.path}`,
    label: result.title,
    hint: result.path,
    keywords: [result.path, result.title, result.snippet],
    run: () => {
      onOpenNote(result.path);
      closePalette();
    },
  };
}
