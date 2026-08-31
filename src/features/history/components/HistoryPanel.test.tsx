import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HistoryPanel } from "./HistoryPanel";

const historyApiMock = vi.hoisted(() => ({ history: vi.fn(), diff: vi.fn(), restore: vi.fn() }));
const syncApiMock = vi.hoisted(() => ({
  status: vi.fn(), commit: vi.fn(), pull: vi.fn(), push: vi.fn(), syncNow: vi.fn(), resolveConflict: vi.fn(),
}));

vi.mock("@/api", () => ({
  historyApi: historyApiMock,
  syncApi: syncApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const LATEST = { id: "b".repeat(40), shortId: "bbbbbbb", message: "second", author: "alice", timestamp: 2 };
const PREVIOUS = { id: "a".repeat(40), shortId: "aaaaaaa", message: "first", author: "bob", timestamp: 1 };
const COMMITS = [LATEST, PREVIOUS];

function renderPanel(overrides: Partial<Parameters<typeof HistoryPanel>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = { repoPath: "/repo", path: "daily/a.md", open: true, onClose: vi.fn(), onRestored: vi.fn(), ...overrides };
  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryPanel {...props} />
    </QueryClientProvider>
  );
}

describe("HistoryPanel", () => {
  it("渲染提交列表并默认展示最新提交 diff", async () => {
    historyApiMock.history.mockResolvedValue(COMMITS);
    historyApiMock.diff.mockResolvedValue({ path: "daily/a.md", commitId: LATEST.id, lines: [{ kind: "added", text: "new line" }] });
    renderPanel();
    expect((await screen.findAllByText("second")).length).toBeGreaterThan(0);
    expect(screen.getByText("first")).toBeTruthy();
    expect(await screen.findByText("new line")).toBeTruthy();
    expect(historyApiMock.diff).toHaveBeenCalledWith("daily/a.md", LATEST.id);
  });

  it("点击提交切换 diff", async () => {
    historyApiMock.history.mockResolvedValue(COMMITS);
    historyApiMock.diff.mockResolvedValue({ path: "daily/a.md", commitId: PREVIOUS.id, lines: [{ kind: "removed", text: "old line" }] });
    renderPanel();
    await screen.findByText("first");
    fireEvent.click(screen.getByText("first"));
    expect(await screen.findByText("old line")).toBeTruthy();
    expect(historyApiMock.diff).toHaveBeenCalledWith("daily/a.md", PREVIOUS.id);
  });

  it("恢复需二次确认，成功后触发 onRestored 与 onClose", async () => {
    historyApiMock.history.mockResolvedValue(COMMITS);
    historyApiMock.diff.mockResolvedValue({ path: "daily/a.md", commitId: LATEST.id, lines: [] });
    historyApiMock.restore.mockResolvedValue(null);
    syncApiMock.commit.mockResolvedValue(null);
    const onClose = vi.fn();
    const onRestored = vi.fn();
    renderPanel({ onClose, onRestored });
    expect((await screen.findAllByText("second")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("恢复此版本"));
    fireEvent.click(screen.getByText("确认恢复"));
    await waitFor(() => {
      expect(historyApiMock.restore).toHaveBeenCalledWith("daily/a.md", LATEST.id);
      expect(onRestored).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
