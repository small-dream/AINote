import { parser, GFM } from "@lezer/markdown";
import type { Tree } from "@lezer/common";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./plan";

const md = parser.configure([GFM]);

function planFor(text: string, cursor: number): ReturnType<typeof planSoftRender> {
  return planSoftRender(md.parse(text) as Tree, text, cursor);
}

describe("planSoftRender 转义符", () => {
  it("隐藏反斜杠，保留转义后的字面字符", () => {
    const text = "a \\[b";
    const plan = planFor(text, 0);
    const backslashPos = text.indexOf("\\");
    expect(plan.hides.find((h) => h.from === backslashPos && h.to === backslashPos + 1)).toMatchObject({
      reveal: false,
      zeroWidth: true,
    });
    expect(plan.marks.find((m) => m.cls === "cm-sr-inline-code")).toBeUndefined();
  });

  it("光标进入转义符时淡显反斜杠", () => {
    const text = "a \\[b";
    const backslashPos = text.indexOf("\\");
    expect(planFor(text, backslashPos + 1).hides.find((h) => h.from === backslashPos)?.reveal).toBe(true);
  });
});
