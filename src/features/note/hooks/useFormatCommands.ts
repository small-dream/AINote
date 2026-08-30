import { useCallback, type RefObject } from "react";
import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { FormatResult } from "../utils/format";
import { insertLink } from "../utils/insert";

/** 将格式化纯函数应用到 view（工具栏按钮与快捷键共用的 dispatch 入口） */
export function dispatchFormat(view: EditorView, fn: (s: EditorState) => FormatResult): boolean {
  const result = fn(view.state);
  view.dispatch(
    result.selection
      ? { changes: result.changes, selection: result.selection }
      : { changes: result.changes }
  );
  return true;
}

/** 链接命令：剪贴板内容是 http(s) URL 时自动填充（无权限时静默回退） */
export async function dispatchLink(view: EditorView): Promise<void> {
  let url: string | undefined;
  try {
    const text = (await navigator.clipboard.readText()).trim();
    if (/^https?:\/\/\S+$/.test(text)) url = text;
  } catch {
    // Tauri webview 可能无剪贴板权限，静默回退到占位符
  }
  dispatchFormat(view, (s) => insertLink(s, url));
}

/** 工具栏命令：dispatch 后恢复编辑器焦点（按钮用 onMouseDown preventDefault 兜底） */
export function useFormatCommands(viewRef: RefObject<EditorView | null>) {
  const run = useCallback(
    (fn: (s: EditorState) => FormatResult) => {
      const view = viewRef.current;
      if (!view) return;
      dispatchFormat(view, fn);
      view.focus();
    },
    [viewRef]
  );
  const runLink = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    void dispatchLink(view).then(() => view.focus());
  }, [viewRef]);
  return { run, runLink };
}
