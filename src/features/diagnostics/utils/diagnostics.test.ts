import { describe, expect, it } from "vitest";
import { diagnoseCodeBlocks, diagnoseFrontmatter, diagnoseMarkdown, diagnoseTables, findImageRefs } from "./diagnostics";

describe("diagnoseCodeBlocks", () => {
  it("检测未闭合围栏代码块", () => {
    const issues = diagnoseCodeBlocks("正文\n```js\nconst a = 1;");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("DIAG_CODEBLOCK_1");
    expect(issues[0]?.line).toBe(2);
  });

  it("闭合的代码块不报错", () => {
    expect(diagnoseCodeBlocks("```js\nconst a = 1;\n```")).toHaveLength(0);
  });

  it("~ 围栏同样支持", () => {
    expect(diagnoseCodeBlocks("~~~\ncode\n")).toHaveLength(1);
  });
});

describe("diagnoseTables", () => {
  it("缺少分隔行时提示", () => {
    const issues = diagnoseTables("| a | b |\n| 1 | 2 |");
    expect(issues[0]?.code).toBe("DIAG_TABLE_1");
    expect(issues[0]?.severity).toBe("warning");
  });

  it("列数与表头不一致时逐行提示", () => {
    const issues = diagnoseTables("| a | b |\n| --- | --- |\n| 1 |");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe("DIAG_TABLE_2");
    expect(issues[0]?.line).toBe(3);
  });

  it("正常表格与代码块内竖线不误报", () => {
    expect(diagnoseTables("| a | b |\n| --- | --- |\n| 1 | 2 |")).toHaveLength(0);
    expect(diagnoseTables("```\n| not a table |\n```")).toHaveLength(0);
  });
});

describe("diagnoseFrontmatter", () => {
  it("未闭合 frontmatter 报错", () => {
    const issues = diagnoseFrontmatter("---\ntitle: x");
    expect(issues[0]?.code).toBe("DIAG_FRONTMATTER_1");
  });

  it("YAML 语法错误报错", () => {
    const issues = diagnoseFrontmatter("---\ntitle: [unclosed\n---");
    expect(issues[0]?.code).toBe("DIAG_FRONTMATTER_3");
  });

  it("非键值对（数组）提示", () => {
    const issues = diagnoseFrontmatter("---\n- a\n- b\n---");
    expect(issues[0]?.code).toBe("DIAG_FRONTMATTER_2");
  });

  it("合法 frontmatter 不报错", () => {
    expect(diagnoseFrontmatter("---\ntitle: 测试\ntags:\n  - a\n---\n正文")).toHaveLength(0);
  });
});

describe("diagnoseImageRefs & findImageRefs", () => {
  it("缺地址图片提示", () => {
    const issues = diagnoseMarkdown("![x]( )\n\n正文");
    expect(issues.some((issue) => issue.code === "DIAG_IMAGE_1")).toBe(true);
  });

  it("提取本地与远程图片引用", () => {
    const refs = findImageRefs("![a](assets/a.png) 见 ![b](https://x.com/b.png)");
    expect(refs).toEqual([
      { src: "assets/a.png", line: 1, local: true },
      { src: "https://x.com/b.png", line: 1, local: false },
    ]);
  });

  it("代码块内的图片不提取", () => {
    expect(findImageRefs("```\n![x](assets/a.png)\n```")).toHaveLength(0);
  });
});

describe("diagnoseMarkdown 汇总", () => {
  it("组合多种问题并携带行号", () => {
    const content = "---\ntitle: [bad\n---\n\n| 表 | 头 |\n| 1 |\n\n```js\nconst x = 1;";
    const issues = diagnoseMarkdown(content);
    expect(issues.some((issue) => issue.code === "DIAG_FRONTMATTER_3")).toBe(true);
    expect(issues.some((issue) => issue.code === "DIAG_CODEBLOCK_1")).toBe(true);
    expect(issues.some((issue) => issue.code === "DIAG_TABLE_1")).toBe(true);
  });
});
