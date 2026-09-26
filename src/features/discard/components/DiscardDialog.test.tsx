import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardDialog } from "./DiscardDialog";

const syncApiMock = vi.hoisted(() => ({ statusFiles: vi.fn(), discard: vi.fn() }));

vi.mock("@/api", () => ({
  syncApi: syncApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const FILES = [
  { path: "daily/2026-09-10.md", status: "modified" as const },
  { path: "old.md", status: "deleted" as const },
  { path: "new.md", status: "added" as const },
];

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DiscardDialog repoPath="/repo" onClose={onClose} />
    </QueryClientProvider>
  );
}

describe("DiscardDialog", () => {
  it("展示待提交变更与状态字母，未选中时不可丢弃", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    renderDialog();

    expect(await screen.findByText("daily/2026-09-10.md")).toBeTruthy();
    expect(screen.getAllByText("M").length).toBeGreaterThan(0);
    expect(screen.getByText("已选 0 / 3 个文件")).toBeTruthy();
    expect((screen.getByRole("button", { name: "丢弃选中改动" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("无变更时显示空态", async () => {
    syncApiMock.statusFiles.mockResolvedValue([]);
    renderDialog();
    expect(await screen.findByText("没有可丢弃的改动")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "全选" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("全选后需在确认框中勾选「我了解」才能丢弃选中路径", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.discard.mockResolvedValue({ restored: ["a.md"], deleted: ["new.md"], skipped: [] });
    const onClose = vi.fn();
    renderDialog(onClose);
    await screen.findByText("daily/2026-09-10.md");

    fireEvent.click(screen.getByRole("checkbox", { name: "全选" }));
    expect(screen.getByText("已选 3 / 3 个文件")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "丢弃选中改动" }));
    const confirm = screen.getByRole("button", { name: "确认丢弃" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByText("将彻底删除（不可恢复）：1 个文件")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "我了解这些改动丢弃后无法恢复" }));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(syncApiMock.discard).toHaveBeenCalledWith(["daily/2026-09-10.md", "old.md", "new.md"]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("只提交勾选的路径", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.discard.mockResolvedValue({ restored: ["old.md"], deleted: [], skipped: [] });
    renderDialog();
    await screen.findByText("daily/2026-09-10.md");

    const rows = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // 第 0 个是全选，其后按列表顺序对应文件
    fireEvent.click(rows[2] as HTMLInputElement);
    expect(screen.getByText("已选 1 / 3 个文件")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "丢弃选中改动" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "我了解这些改动丢弃后无法恢复" }));
    fireEvent.click(screen.getByRole("button", { name: "确认丢弃" }));

    await waitFor(() => expect(syncApiMock.discard).toHaveBeenCalledWith(["old.md"]));
  });
});
