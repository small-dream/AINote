import { afterEach } from "vitest";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

// jsdom 不实现 Range.getClientRects / getBoundingClientRect，CodeMirror 的测量循环
// 会在异步帧里抛错。需要挂真实 EditorView 的单测在这里就地修补。
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}

const mounted: EditorView[] = [];

/** 用例结束销毁编辑器：避免残留的测量循环污染后续用例。 */
export function destroyMountedEditors(): void {
  while (mounted.length > 0) mounted.pop()?.destroy();
}

/** 用真实扩展建一个挂载到 body 的编辑器，验证行为而不是实现细节。 */
export function mountEditor(extensions: Extension[], doc: string, anchor = doc.length): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({
    state: EditorState.create({ doc, selection: { anchor }, extensions }),
    parent,
  });
  mounted.push(view);
  return view;
}

/** 派发带 text/plain 的粘贴事件：CodeMirror 的 paste 处理器同步读取 clipboardData。 */
export function pasteInto(view: EditorView, text: string): string {
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData?: unknown };
  Object.defineProperty(event, "clipboardData", { value: { getData: () => text, files: [] } });
  view.contentDOM.dispatchEvent(event);
  return view.state.doc.toString();
}

afterEach(destroyMountedEditors);
