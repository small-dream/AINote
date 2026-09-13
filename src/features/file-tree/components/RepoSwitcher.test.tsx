import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { RepoSwitcher } from "./RepoSwitcher";

const repoApiMock = vi.hoisted(() => ({ list: vi.fn(), switchRepo: vi.fn() }));

vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const REPOS = [
  { id: "/a/work", name: "工作笔记", path: "/a/work", remoteUrl: "https://github.com/u/work.git", providerId: "github" },
  { id: "/b/life", name: "生活", path: "/b/life", remoteUrl: "https://gitee.com/u/life.git", providerId: "gitee" },
];

function renderSwitcher() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoSwitcher />
    </QueryClientProvider>
  );
}

describe("目录树仓库切换器", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: "/a/work", currentNotePath: null, login: null, workspaceEpoch: 0 });
    useUiStore.setState({ settingsOpen: false, settingsTab: "repositories" });
    repoApiMock.list.mockResolvedValue(REPOS);
  });

  it("常驻显示当前仓库名与所属平台", async () => {
    renderSwitcher();

    expect(await screen.findByText("工作笔记")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("展开后列出全部仓库，选择另一个仓库会触发切换", async () => {
    repoApiMock.switchRepo.mockResolvedValue("/b/life");
    renderSwitcher();

    fireEvent.click(await screen.findByRole("button", { name: "切换仓库" }));
    const listbox = await screen.findByRole("listbox", { name: "笔记仓库" });
    expect(within(listbox).getByText("工作笔记")).toBeTruthy();

    fireEvent.click(within(listbox).getByText("生活"));

    await waitFor(() => expect(repoApiMock.switchRepo).toHaveBeenCalledWith("/b/life"));
    await waitFor(() => expect(useSessionStore.getState().repoPath).toBe("/b/life"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("重复选择当前仓库不触发切换", async () => {
    renderSwitcher();

    fireEvent.click(await screen.findByRole("button", { name: "切换仓库" }));
    const listbox = await screen.findByRole("listbox", { name: "笔记仓库" });
    fireEvent.click(within(listbox).getByText("工作笔记"));

    expect(repoApiMock.switchRepo).not.toHaveBeenCalled();
  });

  it("提供管理仓库入口并跳转到设置页仓库分区", async () => {
    renderSwitcher();

    fireEvent.click(await screen.findByRole("button", { name: "切换仓库" }));
    fireEvent.click(await screen.findByText("管理仓库…"));

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsTab).toBe("repositories");
  });
});
