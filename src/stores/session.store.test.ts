import { beforeEach, describe, expect, it } from "vitest";
import { useSessionStore } from "./session.store";

beforeEach(() => {
  useSessionStore.setState({ repoPath: null, currentNotePath: null, login: null, workspaceEpoch: 0 });
});

describe("session.store 仓库切换", () => {
  it("初始未绑定仓库、无打开笔记", () => {
    const state = useSessionStore.getState();
    expect(state.repoPath).toBeNull();
    expect(state.currentNotePath).toBeNull();
    expect(state.workspaceEpoch).toBe(0);
  });

  it("switchRepo 更新路径、清空已开笔记并令 workspaceEpoch +1", () => {
    useSessionStore.setState({ repoPath: "/repo-a", currentNotePath: "daily/a.md", login: "octocat" });

    useSessionStore.getState().switchRepo("/repo-b");

    const state = useSessionStore.getState();
    expect(state.repoPath).toBe("/repo-b");
    expect(state.currentNotePath).toBeNull();
    expect(state.workspaceEpoch).toBe(1);
    expect(state.login).toBe("octocat");
  });

  it("连续切换仓库时 workspaceEpoch 单调递增，驱动工作区整页重挂载", () => {
    useSessionStore.getState().switchRepo("/repo-a");
    useSessionStore.getState().openNote("a.md");
    useSessionStore.getState().switchRepo("/repo-b");

    const state = useSessionStore.getState();
    expect(state.workspaceEpoch).toBe(2);
    expect(state.currentNotePath).toBeNull();
  });

  it("switchRepo(null) 解绑仓库时同样清空笔记并递增 epoch", () => {
    useSessionStore.setState({ repoPath: "/repo-a", currentNotePath: "a.md", workspaceEpoch: 3 });

    useSessionStore.getState().switchRepo(null);

    const state = useSessionStore.getState();
    expect(state.repoPath).toBeNull();
    expect(state.currentNotePath).toBeNull();
    expect(state.workspaceEpoch).toBe(4);
  });

  it("setRepoPath 只更新路径，不清笔记、不触发重挂载", () => {
    useSessionStore.setState({ currentNotePath: "a.md", workspaceEpoch: 2 });

    useSessionStore.getState().setRepoPath("/repo-c");

    const state = useSessionStore.getState();
    expect(state.repoPath).toBe("/repo-c");
    expect(state.currentNotePath).toBe("a.md");
    expect(state.workspaceEpoch).toBe(2);
  });
});

describe("session.store 会话重置", () => {
  it("reset 清空仓库/笔记/登录名并归零 epoch", () => {
    useSessionStore.setState({
      repoPath: "/repo-a",
      currentNotePath: "a.md",
      login: "octocat",
      workspaceEpoch: 5,
    });

    useSessionStore.getState().reset();

    expect(useSessionStore.getState()).toMatchObject({
      repoPath: null,
      currentNotePath: null,
      login: null,
      workspaceEpoch: 0,
    });
  });

  it("openNote 打开与关闭当前笔记", () => {
    useSessionStore.getState().openNote("daily/a.md");
    expect(useSessionStore.getState().currentNotePath).toBe("daily/a.md");
    useSessionStore.getState().openNote(null);
    expect(useSessionStore.getState().currentNotePath).toBeNull();
  });
});
