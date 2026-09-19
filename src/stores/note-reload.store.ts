import { create } from "zustand";

interface NoteReloadState {
  /** 外部写盘（同步 / 冲突解决 / 历史恢复）后请求编辑器重载的纪元信号 */
  epoch: number;
  requestReload: () => void;
}

/**
 * 编辑器重载信号的全局来源：同步 / 冲突解决 / Git Graph 恢复等不经编辑器的工作区写入，
 * 成功后递增纪元驱动 useNoteEditor 重载当前笔记；有脏草稿时调用方不得发出信号。
 */
export const useNoteReloadStore = create<NoteReloadState>((set) => ({
  epoch: 0,
  requestReload: () => set((state) => ({ epoch: state.epoch + 1 })),
}));
