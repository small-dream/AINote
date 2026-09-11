import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolbarOverflowMenu } from "./ToolbarOverflowMenu";

describe("ToolbarOverflowMenu", () => {
  it("富文本笔记把导出 Markdown 合并进溢出菜单并触发回调", () => {
    const onExportMarkdown = vi.fn();
    render(<ToolbarOverflowMenu richText hasConvert={false} isPdfAvailable onExportPdf={vi.fn()} onExportMarkdown={onExportMarkdown} onMove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "导出 Markdown" }));

    expect(onExportMarkdown).toHaveBeenCalledTimes(1);
  });

  it("未提供导出 Markdown 时不渲染该项", () => {
    render(<ToolbarOverflowMenu richText hasConvert={false} isPdfAvailable={false} onMove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));

    expect(screen.queryByRole("menuitem", { name: "导出 Markdown" })).toBeNull();
  });

  it("富文本笔记提供「转换为 Markdown」逆转换入口并触发回调", () => {
    const onConvertToMarkdown = vi.fn();
    render(<ToolbarOverflowMenu richText hasConvert={false} isPdfAvailable={false} onConvertToMarkdown={onConvertToMarkdown} onMove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "转换为 Markdown" }));

    expect(onConvertToMarkdown).toHaveBeenCalledTimes(1);
  });

  it("Markdown 笔记不渲染逆转换入口", () => {
    render(<ToolbarOverflowMenu richText={false} hasConvert={false} isPdfAvailable={false} onMove={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "更多" }));

    expect(screen.queryByRole("menuitem", { name: "转换为 Markdown" })).toBeNull();
  });
});
