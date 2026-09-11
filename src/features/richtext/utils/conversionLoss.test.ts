import { describe, expect, it } from "vitest";
import { detectConversionLosses } from "./conversionLoss";

describe("detectConversionLosses", () => {
  it("普通正文不报告任何损失", () => {
    expect(detectConversionLosses("# 标题\n\n正文段落，无任何特殊语法。")).toEqual([]);
  });

  it("检测 frontmatter 块", () => {
    const losses = detectConversionLosses("---\ntitle: 测试\ntags: [a]\n---\n# 标题");
    expect(losses).toContain("frontmatter");
    expect(losses).not.toContain("callout");
  });

  it("正文中的 --- 分隔线不算 frontmatter", () => {
    expect(detectConversionLosses("# 标题\n\n---\n\n正文")).toEqual([]);
  });

  it("检测 callout 标注块", () => {
    expect(detectConversionLosses("> [!note]\n> 提示内容")).toContain("callout");
    expect(detectConversionLosses("> [!warning] 小心\n> 内容")).toContain("callout");
  });

  it("普通引用不算 callout", () => {
    expect(detectConversionLosses("> 只是引用")).toEqual([]);
  });

  it("检测脚注引用与定义", () => {
    expect(detectConversionLosses("正文[^1]\n\n[^1]: 脚注内容")).toContain("footnote");
  });

  it("检测双链", () => {
    expect(detectConversionLosses("见 [[项目计划]] 和 [[A|别名]]")).toContain("wikiLink");
    expect(detectConversionLosses("没有双链")).not.toContain("wikiLink");
  });

  it("检测标签（行首或空白后，# 后无空格）", () => {
    expect(detectConversionLosses("#项目 正文 #bug")).toContain("tag");
    expect(detectConversionLosses("# 一级标题\n正文")).not.toContain("tag");
    expect(detectConversionLosses("abc#not-tag")).not.toContain("tag");
  });

  it("多类损失按固定顺序全部列出", () => {
    const md = "---\nt: 1\n---\n> [!note]\n> x\n\n[^1]\n\n[[a]] #b";
    expect(detectConversionLosses(md)).toEqual(["frontmatter", "callout", "footnote", "wikiLink", "tag"]);
  });
});
