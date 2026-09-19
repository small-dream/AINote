import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveNoteDialog } from "./MoveNoteDialog";

const moveMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn(),
}));

const noteTreeQuery = vi.hoisted(() => ({
  data: {
    name: "root",
    path: "",
    nodeType: "dir",
    encrypted: false,
    children: [
      { name: "daily", path: "daily", nodeType: "dir", encrypted: false, children: [] },
      { name: "projects", path: "projects", nodeType: "dir", encrypted: false, children: [] },
    ],
  },
  isLoading: false,
}));

vi.mock("@/queries/note.queries", () => ({
  useMoveNoteMutation: () => moveMutation,
}));

vi.mock("@/queries/tree.queries", () => ({
  useNoteTreeQuery: () => noteTreeQuery,
}));

vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

function renderDialog(path = "projects/roadmap.md") {
  return render(
    <MoveNoteDialog
      repoPath="/tmp/repo"
      path={path}
      onClose={vi.fn()}
      onMoved={vi.fn()}
    />,
  );
}

describe("MoveNoteDialog", () => {
  beforeEach(() => {
    moveMutation.mutate.mockReset();
    draftMock.flushPendingDrafts.mockReset();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
  });

  it("默认选中当前目录并展示目录树", () => {
    renderDialog();

    expect(screen.getByRole("treeitem", { name: "projects" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("treeitem", { name: "daily" }).getAttribute("aria-selected")).toBe("false");
  });

  it("选择目录后保留文件名并调用移动", async () => {
    const onClose = vi.fn();
    const onMoved = vi.fn();
    render(<MoveNoteDialog repoPath="/tmp/repo" path="projects/roadmap.md" onClose={onClose} onMoved={onMoved} />);

    fireEvent.click(screen.getByRole("treeitem", { name: "daily" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "projects/roadmap.md", to: "daily/roadmap.md" },
      expect.any(Object),
    ));
  });

  it("移动到根目录时使用完整文件路径", async () => {
    renderDialog("daily/roadmap.md");

    fireEvent.click(screen.getByRole("treeitem", { name: "全部笔记" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "daily/roadmap.md", to: "roadmap.md" },
      expect.any(Object),
    ));
  });
});

describe("MoveNoteDialog 草稿落盘顺序", () => {
  beforeEach(() => {
    moveMutation.mutate.mockReset();
    draftMock.flushPendingDrafts.mockReset();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
  });

  it("移动前先落盘未保存草稿（草稿写回旧路径会复活已移走的文件）", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("treeitem", { name: "daily" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalled());
    expect(draftMock.flushPendingDrafts).toHaveBeenCalledTimes(1);
    expect(draftMock.flushPendingDrafts.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(moveMutation.mutate.mock.invocationCallOrder[0] ?? 0);
  });

  it("草稿落盘未完成前不发起移动", async () => {
    let releaseFlush: () => void = () => undefined;
    draftMock.flushPendingDrafts.mockImplementation(
      () => new Promise<void>((resolve) => { releaseFlush = resolve; }),
    );
    renderDialog();

    fireEvent.click(screen.getByRole("treeitem", { name: "daily" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    // flush 挂起期间绝不移动（移动后旧路径不存在，保存会复活文件）
    await waitFor(() => expect(draftMock.flushPendingDrafts).toHaveBeenCalled());
    expect(moveMutation.mutate).not.toHaveBeenCalled();

    releaseFlush();
    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalled());
  });

  it("草稿落盘失败时中止移动并展示错误", async () => {
    draftMock.flushPendingDrafts.mockRejectedValue({ code: "IO_5001", kind: "io", message: "磁盘已满", retriable: false });
    renderDialog();

    fireEvent.click(screen.getByRole("treeitem", { name: "daily" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await screen.findByText("磁盘已满");
    expect(moveMutation.mutate).not.toHaveBeenCalled();
  });
});
