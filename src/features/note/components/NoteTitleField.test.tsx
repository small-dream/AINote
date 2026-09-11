import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteTitleField } from "./NoteTitleField";

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/queries/note.queries", () => ({
  useMoveNoteMutation: () => ({ mutateAsync, isPending: false }),
}));

function renderField(notePath = "旧名字.md") {
  render(
    <NoteTitleField notePath={notePath} isNewNote={false} draft="" onChange={vi.fn()} flush={vi.fn().mockResolvedValue(undefined)} onRenamed={vi.fn()} />
  );
  return screen.getByLabelText("笔记标题") as HTMLInputElement;
}

describe("NoteTitleField", () => {
  it("新建笔记聚焦工具栏标题，Enter 后同步标题、文件名和当前笔记", async () => {
    const onChange = vi.fn();
    const flush = vi.fn().mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    render(
      <NoteTitleField notePath="未命名.md" isNewNote draft="" onChange={onChange} flush={flush} onRenamed={onRenamed} />
    );
    const input = screen.getByLabelText("笔记标题") as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "VPN" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ from: "未命名.md", to: "VPN.md" }));
    expect(onChange).toHaveBeenCalledWith("# VPN\n\n");
    expect(onRenamed).toHaveBeenCalledWith("VPN.md");
  });

  it("改名失败时渲染错误文案并保留用户输入", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("目标文件已存在"));
    const input = renderField();

    fireEvent.change(input, { target: { value: "新名字" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("目标文件已存在");
    expect(input.value).toBe("新名字");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("再次输入时清除改名错误", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("目标文件已存在"));
    const input = renderField();

    fireEvent.change(input, { target: { value: "新名字" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("alert");

    fireEvent.change(input, { target: { value: "另一个名字" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
  });

  it("重试成功commit后清除错误", async () => {
    mutateAsync
      .mockRejectedValueOnce(new Error("目标文件已存在"))
      .mockResolvedValueOnce(undefined);
    const onRenamed = vi.fn();
    render(
      <NoteTitleField notePath="旧名字.md" isNewNote={false} draft="" onChange={vi.fn()} flush={vi.fn().mockResolvedValue(undefined)} onRenamed={onRenamed} />
    );
    const input = screen.getByLabelText("笔记标题") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "新名字" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByRole("alert");

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("新名字.md"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
