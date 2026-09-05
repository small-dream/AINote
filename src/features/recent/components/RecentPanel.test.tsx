import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentPanel } from "./RecentPanel";
import { useUiStore } from "@/stores/ui.store";

const apiMock = vi.hoisted(() => ({ noteApi: { list: vi.fn() } }));
vi.mock("@/api", () => apiMock);

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0) / 1000;
const NOTE = (path: string, title: string, updatedAt: number) => ({
  path,
  kind: "markdown" as const,
  title,
  updatedAt,
});
const NOTES = [
  NOTE("today.md", "Today", NOW),
  NOTE("week.md", "Week", NOW - 2 * 24 * 60 * 60),
];

function renderPanel() {
  const onSelect = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RecentPanel repoPath="/repo" onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return onSelect;
}

describe("RecentPanel", () => {
  beforeEach(() => {
    useUiStore.setState({
      recentNotes: {
        "/repo": [
          { path: "week.md", openedAt: 3000 },
          { path: "today.md", openedAt: 2000 },
        ],
      },
    });
  });

  it("按本机打开顺序展示并打开笔记", async () => {
    apiMock.noteApi.list.mockResolvedValue(NOTES);
    const onSelect = renderPanel();

    expect(await screen.findByText("Week")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Week/ }));
    expect(onSelect).toHaveBeenCalledWith("week.md");
  });

  it("支持标题或路径过滤", async () => {
    apiMock.noteApi.list.mockResolvedValue(NOTES);
    renderPanel();

    fireEvent.change(await screen.findByLabelText("筛选最近笔记"), { target: { value: "to" } });
    expect(screen.queryByText("Week")).toBeNull();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("可清空当前仓库的最近记录", async () => {
    apiMock.noteApi.list.mockResolvedValue(NOTES);
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "清空" }));
    expect(useUiStore.getState().recentNotes["/repo"]).toBeUndefined();
  });
});
