import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlockScroller } from "./CodeBlockScroller";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderOverflowingScroller() {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
  const result = render(<CodeBlockScroller><code>long code</code></CodeBlockScroller>);
  const pre = result.container.querySelector("pre");
  const scrollbar = result.container.querySelector<HTMLElement>(".markdown-code-scrollbar");
  const thumb = result.container.querySelector<HTMLElement>(".markdown-code-scrollbar-thumb");
  if (!pre || !scrollbar || !thumb) throw new Error("scrollbar not rendered");
  return { ...result, pre, scrollbar, thumb };
}

describe("CodeBlockScroller", () => {
  it("代码溢出时渲染带完整语义的自定义滚动条", () => {
    const { scrollbar, thumb } = renderOverflowingScroller();
    expect(scrollbar.getAttribute("role")).toBe("scrollbar");
    expect(scrollbar.getAttribute("aria-valuemax")).toBe("600");
    expect(thumb.style.width).toBe("100px");
  });

  it("未溢出时不渲染滚动条", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    const { container } = render(<CodeBlockScroller><code>short</code></CodeBlockScroller>);
    expect(container.querySelector(".markdown-code-scrollbar")).toBeNull();
  });

  it("拖动滑块时同步代码块横向滚动位置", () => {
    const { pre, thumb } = renderOverflowingScroller();
    Object.defineProperties(thumb, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: vi.fn(() => true) },
      releasePointerCapture: { value: vi.fn() },
    });

    fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 10 });
    fireEvent.pointerMove(thumb, { pointerId: 1, clientX: 110 });

    expect(pre.scrollLeft).toBe(300);
  });

  it("键盘 Home/End 可将代码块滚到两端", () => {
    const { pre, scrollbar } = renderOverflowingScroller();
    const scrollTo = vi.fn();
    Object.defineProperty(pre, "scrollTo", { value: scrollTo });

    fireEvent.keyDown(scrollbar, { key: "End" });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: "smooth" });
    fireEvent.keyDown(scrollbar, { key: "Home" });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
  });
});
