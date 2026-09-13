import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoInfo } from "@/api/types";
import { repoKeys } from "@/queries/repo.queries";
import { useSessionStore } from "@/stores/session.store";
import { useUiStore } from "@/stores/ui.store";
import { RepoSwitcher } from "./RepoSwitcher";

const repoApiMock = vi.hoisted(() => ({ list: vi.fn(), switchRepo: vi.fn() }));

vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const WORK_REPO = { id: "/a/work", name: "工作笔记", path: "/a/work", remoteUrl: "https://github.com/u/work.git", providerId: "github" };
const LIFE_REPO = { id: "/b/life", name: "生活", path: "/b/life", remoteUrl: "https://gitee.com/u/life.git", providerId: "gitee" };
const REPOS = [WORK_REPO, LIFE_REPO];

/** 预填缓存时首帧即拿到仓库列表，便于断言"列表已就绪"下的渲染结果。 */
function renderSwitcher(cachedRepos?: RepoInfo[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (cachedRepos) queryClient.setQueryData(repoKeys.list, cachedRepos);
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

  it("多仓库时常驻显示当前仓库名与所属平台", async () => {
    renderSwitcher();

    expect(await screen.findByText("工作笔记")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
  });

  it("只绑定一个仓库时整行不渲染，把顶部高度还给目录树", () => {
    const { container } = renderSwitcher([WORK_REPO]);

    expect(screen.queryByRole("button", { name: "切换仓库" })).toBeNull();
    expect(container.childElementCount).toBe(0);
  });

  it("没有任何已绑定仓库时同样不渲染", () => {
    const { container } = renderSwitcher([]);

    expect(container.childElementCount).toBe(0);
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
