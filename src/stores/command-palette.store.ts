import { create } from "zustand";

interface CommandPaletteState {
  open: boolean;
  /** 面板输入内容（全局 UI 态，随面板开合重置） */
  query: string;
  /** 当前高亮索引，随查询变化回到顶部 */
  selected: number;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setQuery: (query: string) => void;
  moveSelection: (delta: number, length: number) => void;
}

/** 命令面板全局态：Cmd+K / 搜索按钮触发，工作区任意位置可用 */
export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  open: false,
  query: "",
  selected: 0,
  openPalette: () => set({ open: true, query: "", selected: 0 }),
  closePalette: () => set({ open: false, query: "", selected: 0 }),
  togglePalette: () =>
    set((state) =>
      state.open ? { open: false, query: "", selected: 0 } : { open: true, query: "", selected: 0 },
    ),
  setQuery: (query) => set({ query, selected: 0 }),
  moveSelection: (delta, length) => {
    if (length <= 0) return;
    set((state) => ({ selected: (state.selected + delta + length) % length }));
  },
}));
