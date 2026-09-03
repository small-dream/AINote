import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MoveNoteDialog } from "./MoveNoteDialog";

const moveMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const noteTreeQuery = vi.hoisted(() => ({
  data: {
    name: "root",
    path: "",
    nodeType: "dir",
    children: [
      { name: "daily", path: "daily", nodeType: "dir", children: [] },
      { name: "projects", path: "projects", nodeType: "dir", children: [] },
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
  });

  it("默认选中当前目录并展示目录树", () => {
    renderDialog();

    expect(screen.getByRole("treeitem", { name: "projects" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("treeitem", { name: "daily" }).getAttribute("aria-selected")).toBe("false");
  });

  it("选择目录后保留文件名并调用移动", () => {
    const onClose = vi.fn();
    const onMoved = vi.fn();
    render(<MoveNoteDialog repoPath="/tmp/repo" path="projects/roadmap.md" onClose={onClose} onMoved={onMoved} />);

    fireEvent.click(screen.getByRole("treeitem", { name: "daily" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "projects/roadmap.md", to: "daily/roadmap.md" },
      expect.any(Object),
    );
  });

  it("移动到根目录时使用完整文件路径", () => {
    renderDialog("daily/roadmap.md");

    fireEvent.click(screen.getByRole("treeitem", { name: "全部笔记" }));
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "daily/roadmap.md", to: "roadmap.md" },
      expect.any(Object),
    );
  });
});
