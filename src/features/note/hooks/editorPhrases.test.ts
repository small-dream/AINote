import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { mountEditor } from "@/test/editorHarness";
import { useEditorExtensions } from "./useEditorExtensions";

function phrases(locale: "zh-CN" | "en-US") {
  useUiStore.setState({ locale });
  const { result } = renderHook(() => useEditorExtensions({ softRenderEnabled: false }));
  return mountEditor(result.current.extensions, "hello").state;
}

describe("查找替换面板短语", () => {
  beforeEach(() => {
    useUiStore.setState({ noteTheme: "classic" });
  });

  it("中文界面翻译面板按钮与播报文案", () => {
    const state = phrases("zh-CN");
    expect(state.phrase("Find")).toBe("查找");
    expect(state.phrase("Replace")).toBe("替换");
    expect(state.phrase("match case")).toBe("区分大小写");
    expect(state.phrase("replace all")).toBe("全部替换");
    expect(state.phrase("close")).toBe("关闭");
  });

  it("英文界面保留 CodeMirror 原文案", () => {
    const state = phrases("en-US");
    expect(state.phrase("Find")).toBe("Find");
    expect(state.phrase("next")).toBe("next");
    expect(state.phrase("Go to line")).toBe("Go to line");
  });

  it("带占位符的播报文案按 CodeMirror 规则替换", () => {
    const state = phrases("zh-CN");
    expect(state.phrase("replaced $ matches", 3)).toBe("已替换 3 处");
  });
});
