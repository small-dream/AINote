import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePreviewContextMenu } from "./usePreviewContextMenu";

const openExternalLink = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/platform/open-link", () => ({
  openExternalLink,
  isExternalHttpUrl: (url?: string | null) => typeof url === "string" && /^https?:\/\//i.test(url),
}));

afterEach(() => {
  openExternalLink.mockClear();
  document.body.innerHTML = "";
});

describe("usePreviewContextMenu", () => {
  it("读取选中文本并复制，复制后关闭菜单", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    document.body.innerHTML = "<p>预览文本</p>";
    const selection = window.getSelection();
    selection?.selectAllChildren(document.body.querySelector("p") as Node);
    const { result } = renderHook(() => usePreviewContextMenu());

    act(() => {
      result.current.handleContextMenu(createEvent("p"));
    });

    expect(result.current.position).toMatchObject({ x: 20, y: 30, selection: "预览文本" });
    act(() => result.current.copySelection());
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("预览文本");
    expect(result.current.position).toBeNull();
  });

  it("外链菜单可交给系统浏览器", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    document.body.innerHTML = `<a href="https://example.com/a">站点</a>`;
    const { result } = renderHook(() => usePreviewContextMenu());
    act(() => result.current.handleContextMenu(createEvent("a")));

    act(() => result.current.openLink());
    await Promise.resolve();

    expect(openExternalLink).toHaveBeenCalledWith("https://example.com/a");
  });

  it("外链菜单可复制链接", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    document.body.innerHTML = `<a href="https://example.com/a">站点</a>`;
    const { result } = renderHook(() => usePreviewContextMenu());
    act(() => result.current.handleContextMenu(createEvent("a")));

    act(() => result.current.copyLink());
    await Promise.resolve();

    expect(writeText).toHaveBeenLastCalledWith("https://example.com/a");
  });

  it("双链菜单回调目标名，不交给系统浏览器", () => {
    const onOpenWiki = vi.fn();
    document.body.innerHTML = `<a href="wiki:%E9%A1%B9%E7%9B%AE">项目</a>`;
    const { result } = renderHook(() => usePreviewContextMenu({ onOpenWiki }));
    act(() => result.current.handleContextMenu(createEvent("a")));

    act(() => result.current.openLink());

    expect(onOpenWiki).toHaveBeenCalledWith("项目");
    expect(openExternalLink).not.toHaveBeenCalled();
  });
});

function createEvent(selector: string) {
  const target = document.body.querySelector(selector) as Element;
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 20,
    clientY: 30,
    target,
  } as unknown as React.MouseEvent<HTMLElement>;
}
