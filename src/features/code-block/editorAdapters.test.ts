import { act, fireEvent, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import { createRichTextExtensions } from "@/features/richtext/utils/extensions";
import { CodeBlockWidget } from "@/features/note/softRender/widgets/block";
import { useUiStore } from "@/stores/ui.store";

beforeEach(() => {
  useUiStore.setState({ locale: "zh-CN" });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
  Object.defineProperty(navigator, "clipboard", { configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function requiredNode<T>(value: T | null | undefined): T {
  if (!value) throw new Error("预期的代码块节点未渲染");
  return value;
}

async function verifyWidgetLifecycle(): Promise<void> {
  const measure = vi.fn();
  const view = { requestMeasure: measure } as unknown as EditorView;
  const widget = new CodeBlockWidget("  source\n", "unknown", 10, 40);
  const dom = widget.toDOM(view);
  document.body.append(dom);
  await act(async () => Promise.resolve());
  const pre = requiredNode(dom.querySelector("pre"));
  const code = pre.firstElementChild;
  const wrap = requiredNode(dom.querySelector<HTMLButtonElement>('button[aria-label="自动换行"]'));
  const before = measure.mock.calls.length;
  fireEvent.click(wrap);
  expect(measure.mock.calls.length).toBeGreaterThan(before);
  expect(pre.firstElementChild).toBe(code);
  expect(pre.textContent).toBe("  source\n");
  expect(dom.querySelector(".note-code-scroll-host")?.getAttribute("contenteditable")).toBe("false");
  expect(widget.ignoreEvent(new MouseEvent("click", { bubbles: true }))).toBe(false);
  const controlEvent = new MouseEvent("click", { bubbles: true });
  wrap.dispatchEvent(controlEvent);
  expect(widget.ignoreEvent(controlEvent)).toBe(true);
  const equalWidget = new CodeBlockWidget("  source\n", "unknown", 10, 40);
  expect(equalWidget.eq(widget)).toBe(true);
  await act(async () => equalWidget.destroy(dom));
  await act(async () => Promise.resolve());
  expect(dom.querySelector("button")).toBeNull();
  expect(pre.classList.contains("note-code-wrapped")).toBe(false);
}

async function verifyRichTextPresentation(): Promise<void> {
  const fence = String.fromCharCode(96).repeat(3);
  const editor = new Editor({ element: document.createElement("div"),
    extensions: createRichTextExtensions(null), content: "# Intro\n\n" + fence + "ts\nconst x = 1\n" + fence });
  const update = vi.fn();
  editor.on("update", update);
  const before = editor.getJSON();
  const selection = editor.state.selection.toJSON();
  const undo = editor.can().undo();
  const code = editor.view.dom.querySelector("code");
  await act(async () => Promise.resolve());
  fireEvent.click(requiredNode(editor.view.dom.querySelector('button[aria-label="自动换行"]')));
  await act(async () => { fireEvent.click(requiredNode(editor.view.dom.querySelector('button[aria-label="复制代码"]'))); });
  expect(editor.getJSON()).toEqual(before);
  expect(editor.state.selection.toJSON()).toEqual(selection);
  expect(editor.can().undo()).toBe(undo);
  expect(update).not.toHaveBeenCalled();
  expect(editor.view.dom.querySelector("code")).toBe(code);
  expect(editor.getHTML()).not.toMatch(/note-code|button|select|wrapped/);
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1");
  editor.destroy();
}

describe("编辑器代码块适配", () => {
  it("Widget 只挂载控件、通知重新测量，并在相等实例复用后清理", async () => {
    await verifyWidgetLifecycle();
  });

  it("富文本复制和换行保留文档、选区、撤销栈与内容 DOM", async () => {
    await verifyRichTextPresentation();
  });

  it("底部语言选择修改所属块而非光标处的块，支持撤销和即时翻译", async () => {
    const block = (text: string) => ({ type: "codeBlock", attrs: { language: "plaintext" },
      content: [{ type: "text", text }] });
    const editor = new Editor({ element: document.createElement("div"),
      extensions: createRichTextExtensions(null),
      content: { type: "doc", content: [block("first"), block("second")] } });
    const selects = editor.view.dom.querySelectorAll("select");
    const first = requiredNode(selects.item(0));
    const second = requiredNode(selects.item(1));
    const selection = editor.state.selection.toJSON();
    fireEvent.change(second, { target: { value: "rust" } });
    expect(editor.getJSON().content?.[0]?.attrs?.language).toBe("plaintext");
    expect(editor.getJSON().content?.[1]?.attrs?.language).toBe("rust");
    expect(editor.state.selection.toJSON()).toEqual(selection);
    editor.commands.undo();
    expect(editor.getJSON().content?.[1]?.attrs?.language).toBe("plaintext");
    act(() => useUiStore.setState({ locale: "en-US" }));
    await waitFor(() => expect(first.getAttribute("aria-label")).toBe("Code language"));
    expect(first.options[0]?.textContent).toBe("Auto detect");
    await act(async () => editor.destroy());
  });
});
