import { afterEach, describe, expect, it, vi } from "vitest";
import { usesNativeTextContextMenu } from "./text-context-menu";

vi.mock("./runtime", () => ({ isMobileApp: vi.fn(() => false) }));
import { isMobileApp } from "./runtime";

afterEach(() => {
  vi.mocked(isMobileApp).mockReset();
  vi.unstubAllGlobals();
});

function eventWith(properties: Record<string, unknown>): MouseEvent {
  const event = new MouseEvent("contextmenu");
  Object.assign(event, properties);
  return event;
}

describe("文本菜单输入来源", () => {
  it.each(["touch", "pen"])("%s 使用系统菜单", (pointerType) => {
    expect(usesNativeTextContextMenu(eventWith({ pointerType }))).toBe(true);
  });

  it("触屏设备外接鼠标仍使用应用右键菜单", () => {
    vi.mocked(isMobileApp).mockReturnValue(true);
    expect(usesNativeTextContextMenu(eventWith({ pointerType: "mouse" }))).toBe(false);
  });

  it.each([true, false])("识别旧 Chromium 的触摸来源：%s", (firesTouchEvents) => {
    expect(usesNativeTextContextMenu(eventWith({ sourceCapabilities: { firesTouchEvents } }))).toBe(firesTouchEvents);
  });

  it("旧移动 WebView 没有输入信息时优先使用系统菜单", () => {
    vi.mocked(isMobileApp).mockReturnValue(true);
    expect(usesNativeTextContextMenu(eventWith({ pointerType: "", sourceCapabilities: null }))).toBe(true);
  });

  it("浏览器粗指针长按使用系统菜单，桌面窄窗不据宽度分流", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    expect(usesNativeTextContextMenu(new MouseEvent("contextmenu"))).toBe(true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    expect(usesNativeTextContextMenu(new MouseEvent("contextmenu"))).toBe(false);
  });

  it("忽略不可用的来源对象", () => {
    expect(usesNativeTextContextMenu(eventWith({ sourceCapabilities: {} }))).toBe(false);
  });
});
