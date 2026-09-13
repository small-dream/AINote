import { describe, expect, it } from "vitest";
import { KEYBOARD_INSET_PROPERTY, applyKeyboardInset, measureKeyboardInset, observeKeyboardInset, type KeyboardInsetHost } from "./keyboard-inset";

interface FakeHost {
  host: KeyboardInsetHost;
  /** 模拟键盘弹起 / 收起或浏览器底栏变化。 */
  setVisible: (height: number, offsetTop?: number, layoutHeight?: number) => void;
  listenerCount: () => number;
}

function createHost(options: { layoutHeight: number; viewportHeight: number; offsetTop?: number; withVisualViewport?: boolean }): FakeHost {
  const listeners = new Set<() => void>();
  const viewportListeners = new Set<() => void>();
  const state = { viewportHeight: options.viewportHeight, offsetTop: options.offsetTop ?? 0 };
  const viewport = {
    get height() {
      return state.viewportHeight;
    },
    get offsetTop() {
      return state.offsetTop;
    },
    addEventListener: (_type: string, listener: () => void) => void viewportListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void viewportListeners.delete(listener),
  };
  const host: KeyboardInsetHost = {
    innerHeight: options.layoutHeight,
    visualViewport: options.withVisualViewport === false ? null : viewport,
    addEventListener: (_type: string, listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => void listeners.delete(listener),
  };
  return {
    host,
    setVisible: (height, offsetTop = 0, layoutHeight = options.layoutHeight) => {
      state.viewportHeight = height;
      state.offsetTop = offsetTop;
      host.innerHeight = layoutHeight;
      for (const listener of [...listeners, ...viewportListeners]) listener();
    },
    listenerCount: () => listeners.size + viewportListeners.size,
  };
}

describe("measureKeyboardInset", () => {
  it("键盘收起时无遮挡", () => {
    expect(measureKeyboardInset({ height: 800, offsetTop: 0, addEventListener: noop, removeEventListener: noop }, 800)).toBe(0);
  });

  it("键盘弹起时返回被遮挡的高度", () => {
    expect(measureKeyboardInset({ height: 500, offsetTop: 0, addEventListener: noop, removeEventListener: noop }, 800)).toBe(300);
  });

  it("页面被上推的部分不计入遮挡", () => {
    expect(measureKeyboardInset({ height: 500, offsetTop: 300, addEventListener: noop, removeEventListener: noop }, 800)).toBe(0);
  });

  it("可视区域超出布局视口时返回 0（clamp，不产生负值）", () => {
    expect(measureKeyboardInset({ height: 900, offsetTop: 0, addEventListener: noop, removeEventListener: noop }, 800)).toBe(0);
  });
});

describe("observeKeyboardInset", () => {
  it("订阅时立即回调当前遮挡高度，并在键盘弹起 / 收起时更新", () => {
    const fake = createHost({ layoutHeight: 800, viewportHeight: 800 });
    const seen: number[] = [];
    const stop = observeKeyboardInset((inset) => seen.push(inset), fake.host);

    fake.setVisible(500);
    fake.setVisible(800);

    expect(seen).toEqual([0, 300, 0]);
    stop();
  });

  it("取消订阅后不再回调，且移除全部监听器", () => {
    const fake = createHost({ layoutHeight: 800, viewportHeight: 800 });
    const seen: number[] = [];
    const stop = observeKeyboardInset((inset) => seen.push(inset), fake.host);
    stop();

    fake.setVisible(500);

    expect(seen).toEqual([0]);
    expect(fake.listenerCount()).toBe(0);
  });

  it("没有 visualViewport 时只回调一次 0（老 WebView / 浏览器）", () => {
    const fake = createHost({ layoutHeight: 800, viewportHeight: 800, withVisualViewport: false });
    const seen: number[] = [];
    const stop = observeKeyboardInset((inset) => seen.push(inset), fake.host);
    stop();

    expect(seen).toEqual([0]);
  });
});

describe("applyKeyboardInset", () => {
  it("键盘弹起时写入 --kb-inset，收起时移除该属性", () => {
    const fake = createHost({ layoutHeight: 800, viewportHeight: 800 });
    const stop = applyKeyboardInset(document, fake.host);

    expect(document.documentElement.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe("");

    fake.setVisible(520);
    expect(document.documentElement.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe("280px");

    fake.setVisible(800);
    expect(document.documentElement.style.getPropertyValue(KEYBOARD_INSET_PROPERTY)).toBe("");
    stop();
  });

  it("没有文档（非浏览器环境）时安全返回空订阅", () => {
    expect(() => applyKeyboardInset(null, createHost({ layoutHeight: 800, viewportHeight: 800 }).host)()).not.toThrow();
  });
});

function noop(): void {}
