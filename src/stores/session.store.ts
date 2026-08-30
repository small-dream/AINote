import { create } from "zustand";

interface SessionState {
  /** 已绑定的本地仓库路径；null 表示未绑定（应跳转 /setup） */
  repoPath: string | null;
  currentNotePath: string | null;
  /** GitHub 登录名（仅用于 UI 展示，Token 永不到前端） */
  login: string | null;
  setRepoPath: (path: string) => void;
  openNote: (path: string | null) => void;
  setLogin: (login: string | null) => void;
  /** logout 后清空会话 */
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  repoPath: null,
  currentNotePath: null,
  login: null,
  setRepoPath: (repoPath) => set({ repoPath }),
  openNote: (currentNotePath) => set({ currentNotePath }),
  setLogin: (login) => set({ login }),
  reset: () => set({ repoPath: null, currentNotePath: null, login: null }),
}));
