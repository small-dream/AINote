import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TreeSearchInput, TreeSearchResults } from "./TreeSearch";

describe("TreeSearchInput", () => {
  it("渲染占位符并响应输入", () => {
    const onChange = vi.fn();
    render(<TreeSearchInput value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("搜索笔记…"), {
      target: { value: "rust" },
    });
    expect(onChange).toHaveBeenCalledWith("rust");
  });

  it("有输入时展示清除按钮，点击清空", () => {
    const onChange = vi.fn();
    render(<TreeSearchInput value="rust" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "清除搜索" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("TreeSearchResults", () => {
  const result = { path: "daily/foo.md", title: "Foo", snippet: "hello", line: 1, updatedAt: 1 };

  it("命中时渲染列表并点击打开笔记", () => {
    const onSelect = vi.fn();
    render(<TreeSearchResults query="foo" results={[result]} isSearching={false} error={null} onSelect={onSelect} />);

    expect(screen.getByText("Foo")).toBeTruthy();
    expect(screen.getByText("daily/foo.md")).toBeTruthy();
    fireEvent.click(screen.getByText("Foo"));
    expect(onSelect).toHaveBeenCalledWith("daily/foo.md");
  });

  it("无命中且非搜索态展示无结果提示", () => {
    render(<TreeSearchResults query="bar" results={[]} isSearching={false} error={null} onSelect={vi.fn()} />);
    expect(screen.getByText(/没有匹配「bar」的笔记/)).toBeTruthy();
  });

  it("搜索中展示等待提示", () => {
    render(<TreeSearchResults query="bar" results={[]} isSearching error={null} onSelect={vi.fn()} />);
    expect(screen.getByText("搜索中…")).toBeTruthy();
  });

  it("搜索失败时展示错误信息", () => {
    render(<TreeSearchResults query="bar" results={[]} isSearching={false} error="IPC 不可用" onSelect={vi.fn()} />);
    expect(screen.getByText(/搜索失败：IPC 不可用/)).toBeTruthy();
  });
});
