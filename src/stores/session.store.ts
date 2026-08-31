import { create } from "zustand";

interface SessionState {
  /** 活动仓库的本地路径；null 表示未绑定（应跳转 /setup） */
  repoPath: string | null;
  currentNotePath: string | null;
  /** GitHub 登录名（仅用于 UI 展示，Token 永不到前端） */
  login: string | null;
  /** 每次切换仓库 +1，工作区据此整页重挂载以加载新仓库 */
  workspaceEpoch: number;
  setRepoPath: (path: string) => void;
  openNote: (path: string | null) => void;
  setLogin: (login: string | null) => void;
  /** 切换活动仓库：更新路径、清空已开笔记、触发工作区重挂载 */
  switchRepo: (path: string | null) => void;
  /** logout 后清空会话 */
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  repoPath: null,
  currentNotePath: null,
  login: null,
  workspaceEpoch: 0,
  setRepoPath: (repoPath) => set({ repoPath }),
  openNote: (currentNotePath) => set({ currentNotePath }),
  setLogin: (login) => set({ login }),
  switchRepo: (repoPath) =>
    set((s) => ({
      repoPath,
      currentNotePath: null,
      workspaceEpoch: s.workspaceEpoch + 1,
    })),
  reset: () =>
    set({ repoPath: null, currentNotePath: null, login: null, workspaceEpoch: 0 }),
}));
