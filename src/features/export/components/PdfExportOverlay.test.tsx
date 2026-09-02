import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfExportOverlay } from "./PdfExportOverlay";

const assetUrlMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));
const printPageMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/api", () => ({ assetUrl: assetUrlMock, printPage: printPageMock }));

const RICH_TEXT_JSON = JSON.stringify({
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "富文本标题" }] },
    { type: "paragraph", content: [{ type: "text", text: "富文本正文" }] },
  ],
});

function setup(overrides: Partial<React.ComponentProps<typeof PdfExportOverlay>> = {}) {
  const onClose = vi.fn();
  render(
    <PdfExportOverlay
      open
      title="我的笔记"
      kind="markdown"
      content="# 标题\n\n正文"
      repoPath="/repo"
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onClose };
}

describe("PdfExportOverlay 渲染", () => {
  beforeEach(() => {
    printPageMock.mockClear();
    vi.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("关闭时不渲染", () => {
    render(
      <PdfExportOverlay open={false} title="x" kind="markdown" content="" repoPath={null} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Markdown 内容进入打印预览并支持返回", () => {
    const { onClose } = setup();
    expect(screen.getByRole("dialog", { name: "导出 PDF" })).toBeTruthy();
    expect(document.querySelector(".pdf-export-page")?.textContent).toContain("标题");
    expect(document.body.textContent).toContain("正文");
    fireEvent.click(screen.getByText("返回编辑"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("富文本 TipTap JSON 渲染为可读内容", () => {
    setup({ kind: "richText", content: RICH_TEXT_JSON });
    expect(screen.getByRole("heading", { name: "富文本标题" })).toBeTruthy();
    expect(screen.getByText("富文本正文")).toBeTruthy();
  });
});

describe("PdfExportOverlay 打印", () => {
  beforeEach(() => {
    printPageMock.mockClear();
    vi.spyOn(window, "print").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("打印按钮经原生打印命令触发并恢复文档标题", async () => {
    document.title = "app";
    setup();
    fireEvent.click(screen.getByText("打印"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(printPageMock).toHaveBeenCalledTimes(1);
    expect(window.print).not.toHaveBeenCalled();
    expect(document.title).toBe("app");
  });

  it("原生打印命令失败时回退 window.print", async () => {
    printPageMock.mockRejectedValueOnce(new Error("unsupported"));
    setup();
    fireEvent.click(screen.getByText("打印"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(window.print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("app");
  });
});
