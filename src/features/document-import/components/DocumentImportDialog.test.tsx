import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentImportDialog } from "./DocumentImportDialog";
import type { DocumentImportController, DocumentImportState } from "../hooks/useDocumentImport";
import type { DocumentImportResult } from "../types";

const result: DocumentImportResult = {
  format: "docx",
  sourceName: "报告.docx",
  markdown: "# 报告\n\n正文\n\n![图](ainote-asset://0)",
  assets: [{ fileName: "image-1.png", bytes: new Uint8Array([1]) }],
  warnings: ["formatSimplified"],
  characters: 24,
};

function controller(state: DocumentImportState): DocumentImportController {
  return { state, start: vi.fn(), retry: vi.fn(), confirm: vi.fn(), cancel: vi.fn() };
}

function state(overrides: Partial<DocumentImportState>): DocumentImportState {
  return {
    open: true,
    phase: "converting",
    fileName: "报告.docx",
    dir: "notes",
    progress: { current: 1, total: 2 },
    result: null,
    error: null,
    errorDetail: null,
    ...overrides,
  };
}

describe("DocumentImportDialog", () => {
  it("解析中展示进度且禁用确认", () => {
    const current = controller(state({}));
    render(<DocumentImportDialog controller={current} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText("正在解析第 1 / 2 页")).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "导入笔记" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("预览展示统计、警告并允许确认", () => {
    const current = controller(state({ phase: "ready", result, progress: { current: 1, total: 1 } }));
    render(<DocumentImportDialog controller={current} />);
    expect(screen.getByText("24 个字符")).toBeTruthy();
    expect(screen.getByText("1 张图片将存入 assets/")).toBeTruthy();
    expect(screen.getByText("部分复杂格式已简化或忽略。")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "导入笔记" }));
    expect(current.confirm).toHaveBeenCalledTimes(1);
  });

  it("保存失败时重试按钮重新保存而不是重新解析", () => {
    const current = controller(state({ phase: "error", error: "saveFailed", errorDetail: "disk full", result }));
    render(<DocumentImportDialog controller={current} />);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(current.confirm).toHaveBeenCalledTimes(1);
    expect(current.retry).not.toHaveBeenCalled();
  });
});
