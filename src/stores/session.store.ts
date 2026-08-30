import { create } from "zustand";

interface SessionState {
  /** 已绑定的本地仓库路径；null 表示未绑定（应跳转 /setup） */
  repoPath: string | null;
  currentNotePath: string | null;
  setRepoPath: (path: string) => void;
  openNote: (path: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  repoPath: null,
  currentNotePath: null,
  setRepoPath: (repoPath) => set({ repoPath }),
  openNote: (currentNotePath) => set({ currentNotePath }),
}));
