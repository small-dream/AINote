import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitDialog } from "./CommitDialog";

const syncApiMock = vi.hoisted(() => ({
  statusFiles: vi.fn(),
  workingDiff: vi.fn(),
  commit: vi.fn(),
}));

vi.mock("@/api", () => ({
  syncApi: syncApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const FILES = [
  { path: "daily/2026-09-10.md", status: "modified" as const },
  { path: "new.md", status: "added" as const },
];

function emptyDiff(path = "") {
  return { path, lines: [], binary: false, encrypted: false, truncated: false };
}

function renderDialog(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CommitDialog repoPath="/repo" onClose={onClose} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  syncApiMock.statusFiles.mockReset();
  syncApiMock.workingDiff.mockReset();
  syncApiMock.commit.mockReset();
  syncApiMock.workingDiff.mockResolvedValue(emptyDiff());
});

describe("CommitDialog", () => {
  it("展示待提交变更并自动生成默认 message", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    renderDialog();
    expect(await screen.findByRole("button", { name: /daily\/2026-09-10\.md/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /new\.md/ })).toBeTruthy();
    const textarea = screen.getByLabelText("提交说明") as HTMLTextAreaElement;
    expect(textarea.value).toContain("更新 2 个文件");
    expect(textarea.value).toContain("M daily/2026-09-10.md");
    expect(textarea.value).toContain("A new.md");
  });

  it("自动预览首个文件，点击其他文件切换改动", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.workingDiff.mockImplementation((file: string) =>
      Promise.resolve({
        ...emptyDiff(file),
        lines: [{ kind: "added" as const, text: `${file} 的新增行` }],
      }),
    );
    renderDialog();
    expect(await screen.findByText("daily/2026-09-10.md 的新增行")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /new\.md/ }));
    expect(await screen.findByText("new.md 的新增行")).toBeTruthy();
    expect(syncApiMock.workingDiff).toHaveBeenCalledWith("new.md");
  });

  it("加密笔记不展示密文改动", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.workingDiff.mockResolvedValue({
      ...emptyDiff("daily/2026-09-10.md"),
      encrypted: true,
    });
    renderDialog();
    expect(await screen.findByText("加密笔记，无法预览明文改动")).toBeTruthy();
  });

  it("无变更时显示空态且不可提交", async () => {
    syncApiMock.statusFiles.mockResolvedValue([]);
    renderDialog();
    expect(await screen.findByText("没有待提交的变更")).toBeTruthy();
    expect((screen.getByRole("button", { name: "提交" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("编辑 message 后提交并关闭", async () => {
    syncApiMock.statusFiles.mockResolvedValue(FILES);
    syncApiMock.commit.mockResolvedValue("abcdef0123456789");
    const onClose = vi.fn();
    renderDialog(onClose);
    await screen.findByRole("button", { name: /daily\/2026-09-10\.md/ });
    const textarea = screen.getByLabelText("提交说明");
    fireEvent.change(textarea, { target: { value: "chore: my custom message" } });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));
    await waitFor(() => {
      expect(syncApiMock.commit).toHaveBeenCalledWith("chore: my custom message");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
