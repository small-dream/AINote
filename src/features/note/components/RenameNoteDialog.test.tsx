import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RenameNoteDialog } from "./RenameNoteDialog";

const moveMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock("@/queries/note.queries", () => ({
  useMoveNoteMutation: () => moveMutation,
}));

describe("RenameNoteDialog", () => {
  beforeEach(() => {
    moveMutation.mutate.mockReset();
  });

  it("默认展示不含扩展名的当前文件名", () => {
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);

    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("roadmap");
  });

  it("只替换当前目录中的文件名并保留扩展名", () => {
    render(<RenameNoteDialog path="projects/roadmap.md" onClose={vi.fn()} onRenamed={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "q3-plan" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    expect(moveMutation.mutate).toHaveBeenCalledWith(
      { from: "projects/roadmap.md", to: "projects/q3-plan.md" },
      expect.any(Object),
    );
  });

  it("拒绝空名称和包含斜杠的路径", () => {
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
});
