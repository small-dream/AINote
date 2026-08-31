import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrashPanel } from "./TrashPanel";

const trashApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
  empty: vi.fn(),
}));
vi.mock("@/api", () => ({ trashApi: trashApiMock }));

const ITEM = { id: "t1", path: "daily/old.md", deletedAt: 1700000000, title: "旧笔记" };

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelect = vi.fn();
  render(<QueryClientProvider client={queryClient}><TrashPanel repoPath="/repo" onSelect={onSelect} /></QueryClientProvider>);
  return { onSelect };
}

describe("TrashPanel", () => {
  it("空态展示提示文案", async () => {
    trashApiMock.list.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText("回收站是空的")).toBeTruthy();
  });

  it("恢复回调 onSelect 打开原笔记", async () => {
    trashApiMock.list.mockResolvedValue([ITEM]);
    trashApiMock.restore.mockResolvedValue("daily/old.md");
    const { onSelect } = renderPanel();
    expect(await screen.findByText("旧笔记")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("恢复"));
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("daily/old.md"));
  });

  it("彻底删除调用 remove", async () => {
    trashApiMock.list.mockResolvedValue([ITEM]);
    trashApiMock.remove.mockResolvedValue(null);
    renderPanel();
    expect(await screen.findByText("旧笔记")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("彻底删除"));
    await waitFor(() => expect(trashApiMock.remove).toHaveBeenCalledWith("t1"));
  });

  it("清空回收站需二次确认", async () => {
    trashApiMock.list.mockResolvedValue([ITEM]);
    trashApiMock.empty.mockResolvedValue(null);
    renderPanel();
    fireEvent.click(await screen.findByText("清空回收站"));
    expect(trashApiMock.empty).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("确认清空"));
    await waitFor(() => expect(trashApiMock.empty).toHaveBeenCalled());
  });
});
