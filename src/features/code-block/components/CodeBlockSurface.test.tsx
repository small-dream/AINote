import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { CodeBlockSurface } from "./CodeBlockSurface";

beforeEach(() => {
  useUiStore.setState({ locale: "zh-CN" });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

function requiredNode<T>(value: T | null | undefined): T {
  if (!value) throw new Error("预期的代码块节点未渲染");
  return value;
}

describe("阅读式代码块", () => {
  it("各块独立换行，关闭后从左端恢复，重建后恢复默认", () => {
    const result = render(<><CodeBlockSurface><code>one</code></CodeBlockSurface>
      <CodeBlockSurface><code>two</code></CodeBlockSurface></>);
    const blocks = result.container.querySelectorAll("pre");
    const first = requiredNode(blocks.item(0));
    act(() => fireEvent.click(requiredNode(result.getAllByRole("button", { name: "自动换行" }).at(0))));
    expect(first.classList.contains("note-code-wrapped")).toBe(true);
    expect(requiredNode(blocks.item(1)).classList.contains("note-code-wrapped")).toBe(false);
    first.scrollLeft = 200;
    act(() => fireEvent.click(result.getByRole("button", { name: "取消自动换行" })));
    expect(first.scrollLeft).toBe(0);
    expect(first.textContent).toBe("one");
    act(() => fireEvent.click(requiredNode(result.getAllByRole("button", { name: "自动换行" }).at(0))));
    result.unmount();
    const next = render(<CodeBlockSurface><code>one</code></CodeBlockSurface>);
    expect(next.container.querySelector(".note-code-wrapped")).toBeNull();
  });

  it("复制保留原始缩进、中文和尾换行，成功反馈 1.4 秒后恢复", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const source = "  echo 中文\n\tsecond\n";
    const result = render(<CodeBlockSurface source={source} language="bash"><code>highlighted</code></CodeBlockSurface>);
    await act(async () => { fireEvent.click(result.getByRole("button", { name: "复制代码" })); });
    expect(writeText).toHaveBeenCalledWith(source);
    expect(result.getByRole("status").textContent).toBe("已复制");
    act(() => { vi.advanceTimersByTime(1400); });
    expect(result.getByRole("status").textContent).toBe("");
    result.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("失败可重试且读取最新内容，中英文标签即时切换", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const result = render(<CodeBlockSurface source="old"><code>old</code></CodeBlockSurface>);
    fireEvent.click(result.getByRole("button", { name: "复制代码" }));
    await waitFor(() => expect(result.getByRole("status").textContent).toContain("复制失败"));
    result.rerender(<CodeBlockSurface source="new"><code>new</code></CodeBlockSurface>);
    fireEvent.click(result.getByRole("button", { name: "复制失败，点击重试" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("new"));
    act(() => useUiStore.setState({ locale: "en-US" }));
    expect(result.getByRole("button", { name: "Copy code" })).toBeTruthy();
    expect(result.container.querySelector(".note-code-language")).toBeNull();
  });

  it("异步高亮/内容变化重新测量，卸载后断开观察器", async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const width = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    const result = render(<CodeBlockSurface><code>short</code></CodeBlockSurface>);
    expect(result.queryByRole("scrollbar")).toBeNull();
    width.mockReturnValue(900);
    result.rerender(<CodeBlockSurface><code><span>long highlighted code</span></code></CodeBlockSurface>);
    await waitFor(() => expect(result.getByRole("scrollbar")).toBeTruthy());
    result.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
