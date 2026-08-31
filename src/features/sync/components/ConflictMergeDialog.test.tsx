import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConflictMergeDialog } from "./ConflictMergeDialog";

const syncApiMock = vi.hoisted(() => ({
  conflicts: vi.fn(),
  resolveFile: vi.fn(),
  push: vi.fn(),
  resolveConflict: vi.fn(),
  status: vi.fn(),
  commit: vi.fn(),
  pull: vi.fn(),
  syncNow: vi.fn(),
}));
vi.mock("@/api", () => ({ syncApi: syncApiMock }));

const FILE = { path: "daily/a.md", local: "本地行1\n本地行2", remote: "远端行1" };

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ConflictMergeDialog repoPath="/repo" open onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

describe("ConflictMergeDialog", () => {
  it("展示本地/远端/合并三栏与文件 tab", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    renderDialog();

    expect(await screen.findByText("本地行1")).toBeTruthy();
    expect(screen.getByText("远端行1")).toBeTruthy();
    expect(screen.getByText("daily/a.md")).toBeTruthy();
    expect(screen.getByLabelText("合并结果")).toBeTruthy();
  });

  it("点击本地行追加到合并结果并保存", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockResolvedValue({ ahead: 0, behind: 0, hasUncommitted: false, conflicted: false });
    renderDialog();

    const firstLine = await screen.findByText("本地行1");
    fireEvent.click(firstLine);

    const textarea = screen.getByLabelText("合并结果") as HTMLTextAreaElement;
    expect(textarea.value).toBe("本地行1\n本地行2\n本地行1");
    fireEvent.click(screen.getByText("保存合并"));
    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "本地行1\n本地行2\n本地行1");
    });
  });

  it("关闭时不渲染", () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ConflictMergeDialog repoPath="/repo" open={false} onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
