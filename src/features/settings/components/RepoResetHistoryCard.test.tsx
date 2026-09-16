import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepoResetHistoryCard } from "./RepoResetHistoryCard";

const repoApiMock = vi.hoisted(() => ({ resetHistory: vi.fn() }));
vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const REPORT = {
  commitId: "abcdef1234567890abcdef",
  branch: "main",
  erasedCommits: 42,
  fileCount: 12,
  pushed: true,
  backupCleanupFailed: false,
};

function renderCard(repoName = "my-notes") {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoResetHistoryCard repoName={repoName} />
    </QueryClientProvider>
  );
}

function openDialog() {
  fireEvent.click(screen.getByText("重置历史"));
}

function typeConfirm(value: string) {
  fireEvent.change(screen.getByLabelText(/输入仓库名称/), { target: { value } });
}

function submitButton() {
  return screen.getByText("确认重置").closest("button") as HTMLButtonElement;
}

describe("RepoResetHistoryCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("未逐字输入仓库名称时不能提交", () => {
    renderCard();
    openDialog();

    expect(submitButton().disabled).toBe(true);
    typeConfirm("other-repo");
    expect(submitButton().disabled).toBe(true);
    expect(repoApiMock.resetHistory).not.toHaveBeenCalled();

    typeConfirm("my-notes");
    expect(submitButton().disabled).toBe(false);
  });

  it("确认后按提交说明执行重置并展示结果", async () => {
    repoApiMock.resetHistory.mockResolvedValue(REPORT);
    renderCard();
    openDialog();
    typeConfirm("my-notes");

    fireEvent.click(submitButton());

    expect(await screen.findByText(/已清除 42 个提交/)).toBeTruthy();
    expect(screen.getByText(/abcdef1/)).toBeTruthy();
    expect(repoApiMock.resetHistory).toHaveBeenCalledWith("note: reset history");
  });

  it("提交说明可编辑", async () => {
    repoApiMock.resetHistory.mockResolvedValue(REPORT);
    renderCard();
    openDialog();
    fireEvent.change(screen.getByLabelText("提交说明"), { target: { value: "note: 重新开始" } });
    typeConfirm("my-notes");

    fireEvent.click(submitButton());

    expect(await screen.findByText(/已清除 42 个提交/)).toBeTruthy();
    expect(repoApiMock.resetHistory).toHaveBeenCalledWith("note: 重新开始");
  });

  it("失败时展示原因且不显示结果", async () => {
    repoApiMock.resetHistory.mockRejectedValue(new Error("远端有本地尚未同步的提交，请先同步再重置历史"));
    renderCard();
    openDialog();
    typeConfirm("my-notes");

    fireEvent.click(submitButton());

    expect(await screen.findByText(/重置失败：远端有本地尚未同步的提交/)).toBeTruthy();
    expect(screen.queryByText(/已清除/)).toBeNull();
  });

  it("本地仓库与备份残留给出对应提示", async () => {
    repoApiMock.resetHistory.mockResolvedValue({
      ...REPORT,
      pushed: false,
      backupCleanupFailed: true,
    });
    renderCard();
    openDialog();
    typeConfirm("my-notes");

    fireEvent.click(submitButton());

    expect(await screen.findByText("本地仓库没有远端，本次只在本地生效。")).toBeTruthy();
    expect(screen.getByText(/手动删除 .ainote-git-backup-\* 目录/)).toBeTruthy();
  });
});
