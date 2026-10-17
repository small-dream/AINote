import { create } from "zustand";

/** 跨笔记定位目标：AI 引用与标题级双链共用。 */
export interface NoteNavigationTarget {
  path: string;
  heading?: string | null;
  line?: number | null;
  quote?: string | null;
}

export const NOTE_HISTORY_LIMIT = 50;

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
  /** 用户主动打开笔记的会话内历史；不持久化，也不等同于 Git 版本历史。 */
  noteHistory: string[];
  noteHistoryIndex: number;
  setRepoPath: (path: string) => void;
  openNote: (path: string | null) => void;
  /** 打开目标笔记并请求编辑器定位（同篇笔记也会重新触发）。 */
  navigateTo: (target: NoteNavigationTarget) => void;
  clearNavigation: (nonce: number) => void;
  /** 记录一次主动打开；相邻重复不追加，新分支会截掉前进栈。 */
  rememberVisited: (path: string) => void;
  /** 返回上一条笔记路径；无可后退项时返回 null。 */
  goBackNote: () => string | null;
  goForwardNote: () => string | null;
  setLogin: (login: string | null) => void;
  /** 切换活动仓库：更新路径、清空已开笔记、触发工作区重挂载 */
  switchRepo: (path: string | null) => void;
  /** logout 后清空会话 */
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  repoPath: null,
  currentNotePath: null,
  login: null,
  workspaceEpoch: 0,
  navigationTarget: null,
  navigationNonce: 0,
  noteHistory: [],
  noteHistoryIndex: -1,
  setRepoPath: (repoPath) => set({ repoPath }),
  openNote: (currentNotePath) => set({ currentNotePath, navigationTarget: null }),
  navigateTo: (navigationTarget) => set((state) => ({
    currentNotePath: navigationTarget.path,
    navigationTarget,
    navigationNonce: state.navigationNonce + 1,
  })),
  clearNavigation: (nonce) => set((state) => (state.navigationNonce === nonce ? { navigationTarget: null } : {})),
  rememberVisited: (path) => set((state) => {
    if (state.noteHistory[state.noteHistoryIndex] === path) return {};
    const prefix = state.noteHistory.slice(0, state.noteHistoryIndex + 1);
    const noteHistory = [...prefix, path].slice(-NOTE_HISTORY_LIMIT);
    return { noteHistory, noteHistoryIndex: noteHistory.length - 1 };
  }),
  goBackNote: () => {
    const state = get();
    if (state.noteHistoryIndex <= 0) return null;
    const noteHistoryIndex = state.noteHistoryIndex - 1;
    const currentNotePath = state.noteHistory[noteHistoryIndex] ?? null;
    set({ noteHistoryIndex, currentNotePath, navigationTarget: null });
    return currentNotePath;
  },
  goForwardNote: () => {
    const state = get();
    if (state.noteHistoryIndex >= state.noteHistory.length - 1) return null;
    const noteHistoryIndex = state.noteHistoryIndex + 1;
    const currentNotePath = state.noteHistory[noteHistoryIndex] ?? null;
    set({ noteHistoryIndex, currentNotePath, navigationTarget: null });
    return currentNotePath;
  },
  setLogin: (login) => set({ login }),
  switchRepo: (repoPath) =>
    set((s) => ({
      repoPath,
      currentNotePath: null,
      navigationTarget: null,
      noteHistory: [],
      noteHistoryIndex: -1,
      workspaceEpoch: s.workspaceEpoch + 1,
    })),
  reset: () =>
    set({ repoPath: null, currentNotePath: null, login: null, workspaceEpoch: 0, navigationTarget: null, noteHistory: [], noteHistoryIndex: -1 }),
}));
