import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewNoteDialog } from "./NewNoteDialog";

vi.mock("@/api", () => ({
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderDialog(overrides: Partial<Parameters<typeof NewNoteDialog>[0]> = {}) {
  const props = {
    open: true,
    dir: "",
    existingPaths: new Set<string>(),
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<NewNoteDialog {...props} />);
}

describe("NewNoteDialog", () => {
  it("提交创建时传入规范化路径与默认模板（content 为 null）", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onCreate });

    fireEvent.change(screen.getByPlaceholderText("如：daily/我的笔记（自动补 .md）"), {
      target: { value: "daily/foo" },
    });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ path: "daily/foo.md", content: null });
    });
  });

  it("已存在同名路径时给出提示", () => {
    renderDialog({ existingPaths: new Set(["未命名.md"]) });
    expect(screen.getByText(/已存在同名笔记/)).toBeTruthy();
  });

  it("创建失败时内联展示错误并保持打开", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("invalid path: ../x.md"));
    renderDialog({ onCreate });

    fireEvent.change(screen.getByPlaceholderText("如：daily/我的笔记（自动补 .md）"), {
      target: { value: "../x" },
    });
    fireEvent.click(screen.getByText("创建"));

    await screen.findByText("invalid path: ../x.md");
    expect(screen.getByText("创建")).toBeTruthy();
  });

  it("切换每日模板时路径更新为日期文件名", () => {
    renderDialog();

    fireEvent.click(screen.getByLabelText("每日（日期标题）"));

    const input = screen.getByPlaceholderText(
      "如：daily/我的笔记（自动补 .md）"
    ) as HTMLInputElement;
    expect(input.value).toMatch(/^\d{4}-\d{2}-\d{2}\.md$/);
  });
});
