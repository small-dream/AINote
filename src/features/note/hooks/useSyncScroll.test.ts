import { describe, expect, it } from "vitest";
import type { EditorView } from "@codemirror/view";
import { attachSyncScroll } from "./useSyncScroll";

function makeView() {
  const scrollDOM = document.createElement("div");
  const view = {
    scrollDOM,
    state: { doc: { lineAt: (pos: number) => ({ number: pos + 1 }), line: (n: number) => ({ from: n - 1 }) } },
    lineBlockAtHeight: (height: number) => ({ from: height }),
    lineBlockAt: (pos: number) => ({ top: pos }),
  } as unknown as EditorView;
  return view;
}

/** 预览容器内容坐标 = 元素 top；锚点：line1→0, line5→100, line10→200 */
function makePreview() {
  const preview = document.createElement("div");
  Object.defineProperty(preview, "getBoundingClientRect", { value: () => ({ top: 0 }) });
  const add = (line: number, top: number) => {
    const el = document.createElement("div");
    el.dataset.line = String(line);
    Object.defineProperty(el, "getBoundingClientRect", { value: () => ({ top }) });
    preview.appendChild(el);
  };
  add(1, 0);
  add(5, 100);
  add(10, 200);
  return preview;
}

describe("attachSyncScroll", () => {
  it("编辑器滚动到第 3 行时预览滚动到锚点插值位置", () => {
    const view = makeView();
    const preview = makePreview();
    const detach = attachSyncScroll(view, preview);

    view.scrollDOM.scrollTop = 2;
    view.scrollDOM.dispatchEvent(new Event("scroll"));
    expect(preview.scrollTop).toBe(50);

    detach();
  });

  it("预览滚动到两锚点之间时反向驱动编辑器", () => {
    const view = makeView();
    const preview = makePreview();
    const detach = attachSyncScroll(view, preview);

    preview.scrollTop = 150;
    preview.dispatchEvent(new Event("scroll"));
    expect(view.scrollDOM.scrollTop).toBe(7);

    detach();
  });

  it("detach 后不再同步", () => {
    const view = makeView();
    const preview = makePreview();
    const detach = attachSyncScroll(view, preview);
    detach();

    view.scrollDOM.scrollTop = 2;
    view.scrollDOM.dispatchEvent(new Event("scroll"));
    expect(preview.scrollTop).toBe(0);
  });
});

describe("attachSyncScroll 回声防护", () => {
  it("程序化滚动引发的回声事件不再反向驱动来源面板", () => {
    const view = makeView();
    const preview = makePreview();
    const detach = attachSyncScroll(view, preview);

    view.scrollDOM.scrollTop = 2;
    view.scrollDOM.dispatchEvent(new Event("scroll"));
    expect(preview.scrollTop).toBe(50);

    // 浏览器随后异步派发 preview 的滚动回声（scrollTop 恰为程序化落点）
    preview.dispatchEvent(new Event("scroll"));
    expect(view.scrollDOM.scrollTop).toBe(2);

    detach();
  });

  it("用户在程序化滚动到达前主动滚动时按用户意图处理", () => {
    const view = makeView();
    const preview = makePreview();
    const detach = attachSyncScroll(view, preview);

    view.scrollDOM.scrollTop = 2;
    view.scrollDOM.dispatchEvent(new Event("scroll"));
    expect(preview.scrollTop).toBe(50);

    // 回声未到时用户滚动预览到 150（≠ 程序化落点 50），应驱动编辑器
    preview.scrollTop = 150;
    preview.dispatchEvent(new Event("scroll"));
    expect(view.scrollDOM.scrollTop).toBe(7);

    detach();
  });
});
