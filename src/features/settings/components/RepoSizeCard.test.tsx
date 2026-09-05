import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepoSizeCard } from "./RepoSizeCard";

const repoApiMock = vi.hoisted(() => ({ size: vi.fn() }));

vi.mock("@/api", () => ({ repoApi: repoApiMock }));

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoSizeCard />
    </QueryClientProvider>
  );
}

describe("RepoSizeCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repoApiMock.size.mockResolvedValue({ bytes: 1536 });
  });

  it("显示当前仓库占用并支持刷新", async () => {
    renderCard();
    expect(await screen.findByText("1.5 KB")).toBeTruthy();
    repoApiMock.size.mockResolvedValue({ bytes: 2048 });
    fireEvent.click(screen.getByLabelText("刷新仓库大小"));
    expect(await screen.findByText("2.0 KB")).toBeTruthy();
  });

  it("统计失败时显示不可用", async () => {
    repoApiMock.size.mockRejectedValue(new Error("failed"));
    renderCard();
    expect(await screen.findByText("无法统计")).toBeTruthy();
  });
});
