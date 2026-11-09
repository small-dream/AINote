import { parser, GFM } from "@lezer/markdown";
import type { Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./plan";

const md = parser.configure([GFM]);

function planFor(text: string, cursor: number, selectionTo?: number): ReturnType<typeof planSoftRender> {
  return planSoftRender(md.parse(text) as Tree, text, cursor, selectionTo);
}

describe("planSoftRender 转义符", () => {
  it("隐藏反斜杠，保留转义后的字面字符", () => {
    const text = "a \\[b";
    const plan = planFor(text, 0);
    const backslashPos = text.indexOf("\\");
    expect(plan.hides.find((h) => h.from === backslashPos && h.to === backslashPos + 1)).toMatchObject({ reveal: false });
    expect(plan.marks.find((m) => m.cls === "cm-sr-inline-code")).toBeUndefined();
  });

  it("光标进入转义符时淡显反斜杠", () => {
    const text = "a \\[b";
    const backslashPos = text.indexOf("\\");
    expect(planFor(text, backslashPos + 1).hides.find((h) => h.from === backslashPos)?.reveal).toBe(true);
  });

  it.each(["_", "*", "[", "\\"])("正反向选择转义字符 %s 时保持隐藏反斜杠", (character) => {
    const text = `before \\${character} after`;
    const from = text.indexOf("\\");
    for (const [head, anchor] of [[text.length, 0], [0, text.length], [from + 1, 0], [0, from + 1]] as const) {
      expect(planFor(text, head, anchor).hides.find((hide) => hide.from === from)?.reveal).toBe(false);
    }
  });

  it("光标位于转义节点两侧边界时继续隐藏反斜杠", () => {
    const text = "before \\_ after";
    const from = text.indexOf("\\");
    for (const cursor of [from, from + 2]) {
      expect(planFor(text, cursor).hides.find((hide) => hide.from === from)?.reveal).toBe(false);
    }
  });
});
