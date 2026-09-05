import { describe, expect, it } from "vitest";
import {
  appendTagToContent,
  extractTagsFromContent,
  parseTagInput,
} from "./tagContent";

describe("parseTagInput", () => {
  it("拆分、去重并归一化标签输入", () => {
    expect(parseTagInput("#工作, 项目 #bug")).toEqual(["工作", "项目", "bug"]);
    expect(parseTagInput("重复 重复")).toEqual(["重复"]);
  });
});

describe("extractTagsFromContent", () => {
  it("从 Markdown 中提取标签并忽略标题", () => {
    expect(extractTagsFromContent("# 标题\n正文 #Tag #中文", "markdown")).toEqual(["tag", "中文"]);
  });

  it("从富文本 JSON 中提取标签", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "#标题" }] },
        { type: "paragraph", content: [{ type: "text", text: "正文 #产品" }] },
      ],
    });
    expect(extractTagsFromContent(doc, "richText")).toEqual(["标题", "产品"]);
  });
});

describe("appendTagToContent", () => {
  it("在 Markdown 末尾追加标签且不重复", () => {
    expect(appendTagToContent("正文", "项目", "markdown")).toBe("正文\n\n#项目");
    expect(appendTagToContent("正文 #项目", "项目", "markdown")).toBe("正文 #项目");
  });

  it("在富文本 JSON 末尾追加标签段落", () => {
    const next = appendTagToContent(JSON.stringify({ type: "doc", content: [] }), "项目", "richText");
    expect(JSON.parse(next).content.at(-1).content[0].text).toBe("#项目");
  });
});
