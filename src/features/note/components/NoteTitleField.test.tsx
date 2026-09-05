import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteTitleField } from "./NoteTitleField";

const mutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock("@/queries/note.queries", () => ({
  useMoveNoteMutation: () => ({ mutateAsync, isPending: false }),
}));

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
});
