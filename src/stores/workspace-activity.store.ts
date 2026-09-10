import { create } from "zustand";

interface WorkspaceActivityState {
  version: number;
  markActivity: () => void;
}

/** 工作区文件变更版本；每次落盘（保存/导入/移动等）后自增，供依赖「最近是否有写入」的 UI 复用。 */
export const useWorkspaceActivityStore = create<WorkspaceActivityState>((set) => ({
  version: 0,
  markActivity: () => set((state) => ({ version: state.version + 1 })),
}));
