import { parser } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./plan";

describe.each(["```", "~~~"])("代码块选区隐藏 %s 围栏", (fence) => {
  const code = "if (ready) {\n\nrun();\n\n}";
  const text = `before\n\n${fence}js\n${code}\n${fence}\n\nafter`;
  const opening = text.indexOf(fence);
  const body = text.indexOf(code);
  const closing = text.lastIndexOf(fence);
  const tree = parser.parse(text);

  const selections: Array<readonly [number, number]> = [
    [body, closing],
    [body, closing + 1],
    [body, closing + fence.length],
    [opening + 1, body + 2],
    [opening, closing + fence.length],
    [0, text.length],
  ];

  it.each(selections)("选中 %i 至 %i 时双向选择均不露出围栏", (from, to) => {
    for (const [head, anchor] of [[from, to], [to, from]] as const) {
      const plan = planSoftRender(tree, text, head, anchor);
      expect(plan.hides).toHaveLength(3);
      expect(plan.hides.every((hide) => !hide.reveal)).toBe(true);
      expect(plan.widgets.some((widget) => widget.kind === "codeblock-edit-header")).toBe(true);
      const selected = plan.marks.find((mark) => mark.cls === "cm-sr-code-selection");
      expect(selected).toEqual({
        from: Math.max(from, body),
        to: Math.min(to, body + code.length),
        cls: "cm-sr-code-selection",
      });
    }
  });

  it("取消选择后光标位于围栏内部时仍可编辑围栏", () => {
    for (const start of [opening, closing]) {
      const plan = planSoftRender(tree, text, start + 1);
      expect(plan.hides.find((hide) => hide.from === start)?.reveal).toBe(true);
    }
  });
});
