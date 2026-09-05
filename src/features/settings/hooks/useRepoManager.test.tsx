import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useRepoManager } from "./useRepoManager";

const repoApiMock = vi.hoisted(() => ({
  size: vi.fn(),
  list: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
  switchRepo: vi.fn(),
}));

vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const REPOS = [
  { id: "/a/work", name: "工作", path: "/a/work", remoteUrl: "https://github.com/u/work.git" },
  { id: "/b/life", name: "生活", path: "/b/life", remoteUrl: null },
];

type Manager = ReturnType<typeof useRepoManager>;

function renderManager() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let api: Manager | undefined;
  function Harness() {
    api = useRepoManager();
    return (
      <Routes>
        <Route path="/workspace" element={<div>workspace-page</div>} />
        <Route path="/setup" element={<div>setup-page</div>} />
      </Routes>
    );
  }
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/workspace"]}>
        <Harness />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return () => api as Manager;
}

function resetSession() {
  useSessionStore.setState({
    repoPath: "/a/work",
    currentNotePath: null,
    login: null,
    workspaceEpoch: 0,
  });
}

describe("useRepoManager 列表与重命名", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetSession();
    repoApiMock.size.mockResolvedValue({ bytes: 0 });
  });

  it("列出已绑定仓库", async () => {
    repoApiMock.list.mockResolvedValue(REPOS);
    const getApi = renderManager();
    await waitFor(() => expect(getApi().repos).toEqual(REPOS));
  });

  it("重命名成功后刷新列表", async () => {
    repoApiMock.list.mockResolvedValue(REPOS);
    repoApiMock.rename.mockResolvedValue(null);
    const getApi = renderManager();
    await waitFor(() => expect(getApi().repos).toEqual(REPOS));
    await getApi().rename.mutateAsync({ id: "/a/work", name: "研发" });
    expect(repoApiMock.rename).toHaveBeenCalledWith("/a/work", "研发");
  });
});

describe("useRepoManager 移除仓库", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetSession();
  });

  it("移除活动仓库后切换到新活动路径并触发工作区重挂载", async () => {
    repoApiMock.list.mockResolvedValue(REPOS);
    repoApiMock.remove.mockResolvedValue("/b/life");
    const getApi = renderManager();
    await waitFor(() => expect(getApi().repos).toEqual(REPOS));
    await getApi().remove.mutateAsync("/a/work");
    const state = useSessionStore.getState();
    expect(state.repoPath).toBe("/b/life");
    expect(state.currentNotePath).toBeNull();
    expect(state.workspaceEpoch).toBe(1);
  });

  it("移除最后一个仓库后清空会话并回到 /setup", async () => {
    repoApiMock.list.mockResolvedValue(REPOS);
    repoApiMock.remove.mockResolvedValue(null);
    const getApi = renderManager();
    await waitFor(() => expect(getApi().repos).toEqual(REPOS));
    await getApi().remove.mutateAsync("/a/work");
    await screen.findByText("setup-page");
    expect(useSessionStore.getState().repoPath).toBeNull();
  });
});
