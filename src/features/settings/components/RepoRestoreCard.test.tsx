import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session.store";
import { RepoRestoreCard } from "./RepoRestoreCard";

const repoApiMock = vi.hoisted(() => ({ restoreBackup: vi.fn() }));
vi.mock("@/api", () => ({
  repoApi: repoApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoRestoreCard />
    </QueryClientProvider>
  );
}

describe("RepoRestoreCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useSessionStore.setState({ repoPath: null, currentNotePath: null });
  });

  it("恢复成功后提示并切换活动仓库", async () => {
    repoApiMock.restoreBackup.mockResolvedValue({
      repoPath: "/data/notes/my-notes",
      name: "my-notes",
      fileCount: 12,
    });
    renderCard();

    fireEvent.click(screen.getByText("选择备份并恢复"));
    expect(await screen.findByText("已恢复「my-notes」，共 12 个文件。")).toBeTruthy();
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
    await waitFor(() => expect(useSessionStore.getState().repoPath).toBe("/data/notes/my-notes"));
  });

  it("用户取消选择文件时提示已取消", async () => {
    repoApiMock.restoreBackup.mockResolvedValue(null);
    renderCard();

    fireEvent.click(screen.getByText("选择备份并恢复"));
    expect(await screen.findByText("已取消恢复，未写入任何文件。")).toBeTruthy();
  });

  it("校验失败时展示原因", async () => {
    repoApiMock.restoreBackup.mockRejectedValue(new Error("备份包校验失败：内容与 manifest 中的 sha256 不一致"));
    renderCard();

    fireEvent.click(screen.getByText("选择备份并恢复"));
    expect(
      await screen.findByText("恢复失败：备份包校验失败：内容与 manifest 中的 sha256 不一致")
    ).toBeTruthy();
    expect(useSessionStore.getState().repoPath).toBeNull();
  });
});
