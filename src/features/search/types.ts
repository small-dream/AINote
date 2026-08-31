import type { SearchResult } from "@/api/types";

export type { SearchResult };

/** 命令面板可触达的工作区动作（由页面层注入，避免 feature 依赖 pages） */
export interface CommandPaletteActions {
  onOpenNote: (path: string) => void;
  onNewNote: () => void;
  onNewFolder: () => void;
}
