import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("@/api/back-button.api", () => ({ isTauriRuntime: mocks.isTauriRuntime }));

import { isAndroidApp, isIosApp, isMobileApp } from "./runtime";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 17; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.0.0 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
/** iPadOS 13+ 默认上报桌面级 UA，只能靠触点数量区分 iPad 与 Mac */
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15";

function stubNavigator(userAgent: string, maxTouchPoints = 0): void {
  Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(window.navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

beforeEach(() => {
  mocks.isTauriRuntime.mockReset();
  mocks.isTauriRuntime.mockReturnValue(true);
  stubNavigator(MAC_UA);
});

describe("平台判定", () => {
  it("浏览器环境（无 Tauri 壳）一律不是移动壳", () => {
    mocks.isTauriRuntime.mockReturnValue(false);
    stubNavigator(ANDROID_UA, 2);
    expect(isAndroidApp()).toBe(false);
    expect(isIosApp()).toBe(false);
    expect(isMobileApp()).toBe(false);
  });

  it("Android 壳只认 Android", () => {
    stubNavigator(ANDROID_UA, 2);
    expect(isAndroidApp()).toBe(true);
    expect(isIosApp()).toBe(false);
    expect(isMobileApp()).toBe(true);
  });

  it("iPhone 壳（WKWebView UA）判定为 iOS", () => {
    stubNavigator(IPHONE_UA, 5);
    expect(isIosApp()).toBe(true);
    expect(isAndroidApp()).toBe(false);
  });

  it("iPadOS 桌面级 UA 用触点数量区分 iPad 与 Mac", () => {
    stubNavigator(IPAD_DESKTOP_UA, 5);
    expect(isIosApp()).toBe(true);
    expect(isMobileApp()).toBe(true);
  });

  it("macOS 桌面壳（无触点）不算移动壳", () => {
    stubNavigator(MAC_UA, 0);
    expect(isIosApp()).toBe(false);
    expect(isMobileApp()).toBe(false);
  });
});
