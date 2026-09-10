import { GFM, parser } from "@lezer/markdown";
import { describe, expect, it } from "vitest";
import { planSoftRender } from "./utils/plan";

const md = parser.configure([GFM]);

function block(index: number): string[] {
  return [
    `# 标题 ${index}`,
    "",
    `- 列表项 **加粗** 与 *斜体* ${index}`,
    "- [链接](https://example.com) 和 `code`",
    "",
    `> 引用 $E = mc^2$ ${index}`,
    "",
    "```js",
    `const value = ${index};`,
    "```",
    "",
    "| 列 A | 列 B |",
    "| --- | --- |",
    `| ${index} | ${index + 1} |`,
    "",
  ];
}

function buildDoc(targetLines: number): string {
  const lines: string[] = [];
  let index = 0;
  while (lines.length < targetLines) {
    lines.push(...block(index));
    index += 1;
  }
  return lines.join("\n");
}

describe.runIf(import.meta.env.MODE === "perf")("softRender 性能基准", () => {
  it("5000 行 Markdown 解析与软渲染计划生成", () => {
    const text = buildDoc(5_000);
    expect(text.split("\n").length).toBeGreaterThanOrEqual(5_000);

    const parseStarted = performance.now();
    const tree = md.parse(text);
    const parseMs = performance.now() - parseStarted;

    const planStarted = performance.now();
    const plan = planSoftRender(tree, text, 0);
    const planMs = performance.now() - planStarted;

    expect(plan.marks.length).toBeGreaterThan(0);
    expect(plan.widgets.length).toBeGreaterThan(0);
    console.log(
      `AINote baseline: softrender_parse_5000_lines=${parseMs.toFixed(1)}ms softrender_plan_5000_lines=${planMs.toFixed(1)}ms`
    );
  });
});
