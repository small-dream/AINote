import { create } from "zustand";

/** 跨笔记定位目标：AI 引用与标题级双链共用。 */
export interface NoteNavigationTarget {
  path: string;
  heading?: string | null;
  line?: number | null;
  quote?: string | null;
}

interface SessionState {
  /** 活动仓库的本地路径；null 表示未绑定（应跳转 /setup） */
  repoPath: string | null;
  currentNotePath: string | null;
  /** GitHub 登录名（仅用于 UI 展示，Token 永不到前端） */
  login: string | null;
  /** 每次切换仓库 +1，工作区据此整页重挂载以加载新仓库 */
  workspaceEpoch: number;
  /** 待编辑器消费的定位目标；打开其他笔记时清空。 */
  navigationTarget: NoteNavigationTarget | null;
  navigationNonce: number;
  setRepoPath: (path: string) => void;
  openNote: (path: string | null) => void;
  /** 打开目标笔记并请求编辑器定位（同篇笔记也会重新触发）。 */
  navigateTo: (target: NoteNavigationTarget) => void;
  clearNavigation: (nonce: number) => void;
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
  navigationTarget: null,
  navigationNonce: 0,
  setRepoPath: (repoPath) => set({ repoPath }),
  openNote: (currentNotePath) => set({ currentNotePath, navigationTarget: null }),
  navigateTo: (navigationTarget) => set((state) => ({
    currentNotePath: navigationTarget.path,
    navigationTarget,
    navigationNonce: state.navigationNonce + 1,
  })),
  clearNavigation: (nonce) => set((state) => (state.navigationNonce === nonce ? { navigationTarget: null } : {})),
  setLogin: (login) => set({ login }),
  switchRepo: (repoPath) =>
    set((s) => ({
      repoPath,
      currentNotePath: null,
      navigationTarget: null,
      workspaceEpoch: s.workspaceEpoch + 1,
    })),
  reset: () =>
    set({ repoPath: null, currentNotePath: null, login: null, workspaceEpoch: 0, navigationTarget: null }),
}));
