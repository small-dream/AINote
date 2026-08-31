import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { RepoManager } from "./RepoManager";

const repoApiMock = vi.hoisted(() => ({
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

function renderManager() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/workspace"]}>
        <RepoManager />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function resetSession() {
  useSessionStore.setState({
    repoPath: "/a/work",
    currentNotePath: null,
    login: null,
    workspaceEpoch: 0,
  });
}

describe("RepoManager 列表与切换", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetSession();
    repoApiMock.list.mockResolvedValue(REPOS);
  });

  it("渲染仓库列表与「当前」徽标", async () => {
    renderManager();
    expect(await screen.findByText("工作")).toBeTruthy();
    expect(screen.getByText("生活")).toBeTruthy();
    expect(screen.getByText("当前")).toBeTruthy();
  });

  it("点击「设为当前」切换活动仓库", async () => {
    repoApiMock.switchRepo.mockResolvedValue("/b/life");
    renderManager();
    await screen.findByText("工作");
    fireEvent.click(screen.getByLabelText("设为当前：生活"));
    await waitFor(() => {
      expect(repoApiMock.switchRepo).toHaveBeenCalledWith("/b/life");
    });
  });
});

describe("RepoManager 重命名与移除", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetSession();
    repoApiMock.list.mockResolvedValue(REPOS);
  });

  it("重命名弹窗提交时调用 rename", async () => {
    repoApiMock.rename.mockResolvedValue(null);
    renderManager();
    await screen.findByText("工作");
    fireEvent.click(screen.getByLabelText("重命名：工作"));
    const input = screen.getByPlaceholderText("仓库名称") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "研发" } });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() => {
      expect(repoApiMock.rename).toHaveBeenCalledWith("/a/work", "研发");
    });
  });

  it("移除弹窗确认时调用 remove 并关闭", async () => {
    repoApiMock.remove.mockResolvedValue("/a/work");
    renderManager();
    await screen.findByText("工作");
    fireEvent.click(screen.getByLabelText("移除：生活"));
    expect(screen.getByText(/确定移除「生活」/)).toBeTruthy();
    fireEvent.click(screen.getByText("移除"));
    await waitFor(() => {
      expect(repoApiMock.remove).toHaveBeenCalledWith("/b/life");
    });
    expect(screen.queryByText(/确定移除「生活」/)).toBeNull();
  });
});
