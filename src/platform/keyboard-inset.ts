/**
 * 软键盘遮挡高度（CSS px）——移动壳把可视高度收到键盘上方时使用。
 *
 * Android 壳在 edge-to-edge 下不会因键盘缩小窗口：Tauri / wry 既不设置
 * `windowSoftInputMode`，也不处理 `WindowInsetsCompat.Type.ime()`，WebView 只是把 IME
 * 高度作为 visual viewport 的底部 inset 下发（Chromium `AwDisplayCutoutController` →
 * `AwContents#getBottomViewportInset`）。因此布局视口与 `100dvh` 保持不变，编辑器滚动
 * 容器仍按整屏计算，光标就会停在键盘后面。
 *
 * 可视底边（相对布局视口）= `visualViewport.offsetTop + height`，用布局视口高度减去它，
 * 即当前被键盘（或浏览器底栏）遮住的高度。键盘收起、无 `visualViewport`（老 WebView /
 * jsdom）时恒为 0。
 */
export const KEYBOARD_INSET_PROPERTY = "--kb-inset";

export interface KeyboardInsetViewport {
  height: number;
  offsetTop: number;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface KeyboardInsetHost {
  innerHeight: number;
  visualViewport?: KeyboardInsetViewport | null;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** 计算键盘遮挡高度；页面被浏览器上推（offsetTop）的部分不计入遮挡。 */
export function measureKeyboardInset(viewport: KeyboardInsetViewport, layoutHeight: number): number {
  return Math.max(0, Math.round(layoutHeight - viewport.offsetTop - viewport.height));
}

/** 订阅键盘遮挡高度；无 `visualViewport` 时只回调一次 0，返回值为取消订阅函数。 */
export function observeKeyboardInset(listener: (inset: number) => void, host: KeyboardInsetHost | null = defaultHost()): () => void {
  const viewport = host?.visualViewport;
  if (!host || !viewport) {
    listener(0);
    return () => {};
  }
  // window resize 与 visualViewport resize 常在同一帧一起触发，去重避免重复写样式与重复滚动。
  let last: number | null = null;
  const update = () => {
    const inset = measureKeyboardInset(viewport, host.innerHeight);
    if (inset === last) return;
    last = inset;
    listener(inset);
  };
  update();
  // 只订阅 resize：键盘弹起 / 收起必定改变 visualViewport 尺寸；页面被浏览器上推产生的
  // scroll 不应参与计算，否则 iOS 上滚动会让壳高度跟着抖动。
  viewport.addEventListener("resize", update);
  host.addEventListener("resize", update);
  // 兜底：聚焦可编辑控件后键盘才弹起，部分 WebView 的 visualViewport resize 会晚于 focusin 到达。
  host.addEventListener("focusin", update);
  return () => {
    viewport.removeEventListener("resize", update);
    host.removeEventListener("resize", update);
    host.removeEventListener("focusin", update);
  };
}

/**
 * 把键盘遮挡高度写进 `--kb-inset`，未遮挡时移除该属性，供移动壳的
 * `height: calc(100dvh - var(--kb-inset, 0px))` 收缩可视高度。返回取消订阅函数。
 */
export function applyKeyboardInset(doc: Document | null = typeof document === "undefined" ? null : document, host: KeyboardInsetHost | null = defaultHost()): () => void {
  if (!doc) return () => {};
  const root = doc.documentElement;
  return observeKeyboardInset((inset) => {
    if (inset > 0) root.style.setProperty(KEYBOARD_INSET_PROPERTY, `${inset}px`);
    else root.style.removeProperty(KEYBOARD_INSET_PROPERTY);
  }, host);
}

function defaultHost(): KeyboardInsetHost | null {
  return typeof window === "undefined" ? null : window;
}
