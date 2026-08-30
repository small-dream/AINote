import { create } from "zustand";

interface WorkspaceActivityState {
  version: number;
  markActivity: () => void;
}

/** 工作区文件变更版本；用于让空闲提交计时器在每次落盘操作后重新计时。 */
export const useWorkspaceActivityStore = create<WorkspaceActivityState>((set) => ({
  version: 0,
  markActivity: () => set((state) => ({ version: state.version + 1 })),
}));
