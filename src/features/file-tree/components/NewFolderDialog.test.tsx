import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewFolderDialog } from "./NewFolderDialog";

vi.mock("@/api", () => ({
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderDialog(overrides: Partial<Parameters<typeof NewFolderDialog>[0]> = {}) {
  const props = {
    open: true,
    dir: "",
    existingDirs: new Set<string>(),
    onClose: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<NewFolderDialog {...props} />);
}

describe("NewFolderDialog", () => {
  it("提交时传入规范化目录路径", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onCreate });

    fireEvent.change(screen.getByPlaceholderText("请输入文件夹名称"), {
      target: { value: "/daily/2026/" },
    });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith("daily/2026");
    });
  });

  it("已存在目录时给出提示", () => {
    renderDialog({ existingDirs: new Set(["daily"]) });

    fireEvent.change(screen.getByPlaceholderText("请输入文件夹名称"), {
      target: { value: "daily" },
    });

    expect(screen.getByText(/目录已存在/)).toBeTruthy();
  });

  it("目录名以 .md 结尾时拒绝提交", () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onCreate });

    fireEvent.change(screen.getByPlaceholderText("请输入文件夹名称"), {
      target: { value: "daily/foo.md" },
    });
    fireEvent.click(screen.getByText("创建"));

    expect(screen.getByText(/不应以 \.md 结尾/)).toBeTruthy();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("创建失败时内联展示错误", async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error("invalid path"));
    renderDialog({ onCreate });

    fireEvent.change(screen.getByPlaceholderText("请输入文件夹名称"), {
      target: { value: "../x" },
    });
    fireEvent.click(screen.getByText("创建"));

    await screen.findByText("invalid path");
  });
});
