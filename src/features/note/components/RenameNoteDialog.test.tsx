import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RenameNoteDialog } from "./RenameNoteDialog";

const moveMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn(),
}));

vi.mock("@/queries/note.queries", () => ({
  useMoveNoteMutation: () => moveMutation,
}));

vi.mock("@/features/note/utils/draftRegistry", () => draftMock);

describe("RenameNoteDialog", () => {
  beforeEach(() => {
    moveMutation.mutate.mockReset();
    draftMock.flushPendingDrafts.mockReset();
    draftMock.flushPendingDrafts.mockResolvedValue(undefined);
  });

  it("默认展示不含扩展名的当前文件名", () => {
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("roadmap");
  });

  it("只替换当前目录中的文件名并保留扩展名", async () => {
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "q3-plan" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "projects/roadmap.md", to: "projects/q3-plan.md" },
      expect.any(Object),
    ));
  });

  it("拒绝空名称和包含斜杠的路径", async () => {
    render(<RenameNoteDialog path="roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);
    const textbox = screen.getByRole("textbox");

    fireEvent.change(textbox, { target: { value: "folder/new-name" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(screen.getByText("请输入不含斜杠的文件名")).toBeTruthy();
    expect(moveMutation.mutate).not.toHaveBeenCalled();

    fireEvent.change(textbox, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(screen.getByText("请输入不含斜杠的文件名")).toBeTruthy();
    expect(moveMutation.mutate).not.toHaveBeenCalled();
  });

  it("改名前先落盘未保存草稿（草稿写回旧路径会复活已移走的文件）", async () => {
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "q3-plan" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(moveMutation.mutate).toHaveBeenCalled());
    expect(draftMock.flushPendingDrafts).toHaveBeenCalledTimes(1);
    expect(draftMock.flushPendingDrafts.mock.invocationCallOrder[0] ?? 0)
      .toBeLessThan(moveMutation.mutate.mock.invocationCallOrder[0] ?? 0);
  });

  it("草稿落盘失败时中止改名并展示错误", async () => {
    draftMock.flushPendingDrafts.mockRejectedValue({ code: "IO_5001", kind: "io", message: "磁盘已满", retriable: false });
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "q3-plan" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await screen.findByText("磁盘已满");
    expect(moveMutation.mutate).not.toHaveBeenCalled();
  });
});
