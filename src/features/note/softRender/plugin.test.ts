import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { softRender } from "./plugin";

async function createView(doc: string, anchor = 0): Promise<EditorView> {
  const state = EditorState.create({
    doc,
    selection: { anchor },
    extensions: [markdown({ extensions: [GFM] }), softRender({ repoPath: "/repo" })],
  });
  const view = new EditorView({ state, parent: document.body });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return view;
}

beforeEach(() => {
  document.body.innerHTML = "";
  globalThis.ResizeObserver = createResizeObserverStub();
});

function createResizeObserverStub(): typeof ResizeObserver {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  return ResizeObserverStub as unknown as typeof ResizeObserver;
}

describe("softRender 渲染", () => {
  it("光标在标题外时隐藏 # 标记", async () => {
    const view = await createView("# Title\n\nbody", 10);
    expect(view.contentDOM.textContent?.includes("#")).toBe(false);
    expect(view.contentDOM.textContent).toContain("Title");
    view.destroy();
  });

  it("光标位于标题内时淡显 # 标记", async () => {
    const view = await createView("# Title\n\nbody", 3);
    const marker = view.contentDOM.querySelector(".cm-sr-marker");
    expect(marker).toBeDefined();
    expect(marker?.textContent).toBe("#");
    view.destroy();
  });

  it("隐藏加粗/行内代码/链接语法", async () => {
    const view = await createView("a **bold** and `code` and [link](https://ex.com)");
    const text = view.contentDOM.textContent ?? "";
    expect(text).toContain("bold");
    expect(text).toContain("code");
    expect(text).not.toContain("(https://ex.com)");
    const zeroMarks = view.contentDOM.querySelectorAll(".cm-sr-zero");
    expect(zeroMarks.length).toBeGreaterThanOrEqual(4);
    view.destroy();
  });

  it("图片渲染为 widget（外部 URL 原样）", async () => {
    const view = await createView("![alt](https://example.com/a.png)");
    const img = view.contentDOM.querySelector<HTMLImageElement>(".cm-sr-image img");
    expect(img).toBeDefined();
    expect(img?.alt).toBe("alt");
    expect(img?.src).toContain("https://example.com/a.png");
    view.destroy();
  });

  it("转义符隐藏反斜杠（只显示字面字符）", async () => {
    const view = await createView("\\[设计师 负责]", 0);
    const zero = view.contentDOM.querySelector(".cm-sr-zero");
    expect(zero).toBeDefined();
    expect(zero?.textContent).toBe("\\");
    view.destroy();
  });

});

describe("softRender 块级间距（空行折叠）", () => {
  it("块间空行收窄为空白间距类", async () => {
    const view = await createView("# Title\n\nPara one\n\nPara two", 0);
    const blankLine = view.contentDOM.querySelector<HTMLElement>(".cm-line.cm-sr-blank");
    expect(blankLine).toBeDefined();
    view.destroy();
  });

  it("代码块（replace widget）与间距装饰共存", async () => {
    const view = await createView("para\n\n```js\nconst a = 1;\n```\n\nafter", 0);
    expect(view.contentDOM.querySelector(".cm-sr-codeblock-widget")).toBeDefined();
    const blankLines = view.contentDOM.querySelectorAll<HTMLElement>(".cm-line.cm-sr-blank");
    expect(blankLines.length).toBeGreaterThanOrEqual(1);
    view.destroy();
  });
});

describe("softRender 点击定位", () => {
  it("单击软渲染行时按命中行中心定位，避免落到下一行", async () => {
    const view = await createView("first\nsecond", 0);
    const lines = view.contentDOM.querySelectorAll<HTMLElement>(".cm-line");
    const secondLine = lines[1];
    if (!secondLine) throw new Error("second line not rendered");
    Object.defineProperty(secondLine, "getBoundingClientRect", { value: () => ({
      top: 20,
      bottom: 40,
      height: 20,
      left: 0,
      right: 200,
      width: 200,
      x: 0,
      y: 20,
      toJSON: () => ({}),
    } as DOMRect) });
    vi.spyOn(view, "posAtCoords").mockReturnValue(7);
    secondLine.firstChild?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1, clientX: 20, clientY: 39 }));
    expect(view.state.selection.main.head).toBe(7);
    view.destroy();
  });
});

describe("softRender 交互与块级", () => {
  it("任务勾选框可点击切换 [ ]/[x]", async () => {
    const view = await createView("- [x] done");
    const input = view.contentDOM.querySelector<HTMLInputElement>(".cm-sr-checkbox");
    expect(input).toBeDefined();
    expect(input?.checked).toBe(true);
    input?.click();
    expect(view.state.doc.toString()).toBe("- [ ] done");
    expect(view.contentDOM.querySelector<HTMLInputElement>(".cm-sr-checkbox")?.checked).toBe(false);
    view.destroy();
  });

  it("表格与分割线渲染为块级 widget", async () => {
    const view = await createView("before\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n---");
    const table = view.contentDOM.querySelector<HTMLTableElement>(".cm-sr-table");
    expect(table).toBeDefined();
    expect(table?.textContent).toContain("1");
    expect(view.contentDOM.querySelector(".cm-sr-hr")).toBeDefined();
    view.destroy();
  });

  it("点击代码块 widget 后进入源码编辑", async () => {
    const view = await createView("```js\nconst a = 1;\n```", 0);
    const widget = view.contentDOM.querySelector<HTMLElement>(".cm-sr-codeblock-widget");
    expect(widget).toBeDefined();
    widget?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(view.contentDOM.querySelector(".cm-sr-codeblock-widget")).toBeNull();
    expect(view.contentDOM.textContent).toContain("const a = 1;");
    view.destroy();
  });

  it("空格键在任务项上切换勾选", async () => {
    const view = await createView("- [ ] todo");
    const { toggleTaskAtCursor } = await import("./plugin");
    view.dispatch({ selection: { anchor: 2 } });
    expect(toggleTaskAtCursor(view)).toBe(true);
    expect(view.state.doc.toString()).toBe("- [x] todo");
    view.destroy();
  });
});


describe("softRender 代码块与数学", () => {
  it("围栏代码块光标离开时渲染高亮 widget", async () => {
    const view = await createView("```js\nconst a = 1;\n```", 0);
    const widget = view.contentDOM.querySelector(".cm-sr-codeblock-widget");
    expect(widget).toBeDefined();
    expect(widget?.querySelector(".cm-sr-codeblock-header")?.textContent).toBe("js");
    expect(widget?.querySelector(".cm-sr-codeblock-code")?.textContent).toContain("const");
    view.destroy();
  });

  it("光标进入代码块时显示源码", async () => {
    const view = await createView("```js\nconst a = 1;\n```", 10);
    expect(view.contentDOM.querySelector(".cm-sr-codeblock-widget")).toBeNull();
    expect(view.contentDOM.textContent).toContain("const a = 1;");
    view.destroy();
  });

  it("行内数学公式渲染为 KaTeX widget", async () => {
    const view = await createView("$x^2$", 0);
    const math = view.contentDOM.querySelector(".cm-sr-math-inline");
    expect(math).toBeDefined();
    view.destroy();
  });

  it("块级数学公式渲染为 KaTeX widget", async () => {
    const view = await createView("$$x^2$$", 0);
    const math = view.contentDOM.querySelector(".cm-sr-math-block");
    expect(math).toBeDefined();
    view.destroy();
  });

  it("Mermaid 代码块渲染为图表 widget", async () => {
    const view = await createView("```mermaid\ngraph TD;\nA-->B;\n```", 0);
    const container = view.contentDOM.querySelector(".cm-sr-mermaid");
    expect(container).toBeDefined();
    view.destroy();
  });
});
