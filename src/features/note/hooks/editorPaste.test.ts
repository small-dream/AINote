import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mountEditor, pasteInto } from "@/test/editorHarness";
import { useEditorExtensions } from "./useEditorExtensions";

/** source 模式（softRender 关闭）下的真实扩展 + 真实 EditorView。 */
function extensions() {
  const { result } = renderHook(() => useEditorExtensions({ softRenderEnabled: false }));
  return result.current.extensions;
}

describe("多行粘贴保持缩进", () => {
  it("列表项内第二行不脱出列表", () => {
    const view = mountEditor(extensions(), "- first\n- ");
    expect(pasteInto(view, "alpha\nbeta")).toBe("- first\n- alpha\n  beta");
  });

  it("引用内给后续行补引用标记", () => {
    const view = mountEditor(extensions(), "> ");
    expect(pasteInto(view, "alpha\nbeta")).toBe("> alpha\n> beta");
  });

  it("嵌套列表与任务列表按内容起点对齐", () => {
    const nested = mountEditor(extensions(), "- outer\n  - ");
    expect(pasteInto(nested, "alpha\nbeta")).toBe("- outer\n  - alpha\n    beta");
    const task = mountEditor(extensions(), "- [ ] ");
    expect(pasteInto(task, "alpha\nbeta")).toBe("- [ ] alpha\n      beta");
  });

  it("普通段落内不受影响", () => {
    const view = mountEditor(extensions(), "para ");
    expect(pasteInto(view, "alpha\nbeta")).toBe("para alpha\nbeta");
  });

  it("单行粘贴保持原样", () => {
    const view = mountEditor(extensions(), "- ");
    expect(pasteInto(view, "alpha")).toBe("- alpha");
  });
});
