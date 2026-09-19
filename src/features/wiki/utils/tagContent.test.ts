import { describe, expect, it } from "vitest";
import {
  appendTagToContent,
  extractTagsFromContent,
  parseTagInput,
  removeTagFromContent,
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

  it("已有 #worklog 时仍能追加 #work（includes 前缀误判修复）", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "日志 #worklog" }] }],
    });
    const next = appendTagToContent(doc, "work", "richText");
    const parsed = JSON.parse(next);
    expect(parsed.content).toHaveLength(2);
    expect(parsed.content.at(-1).content[0].text).toBe("#work");
  });

  it("富文本中已有同名标签（大小写不同）时不重复追加", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "正文 #Work" }] }],
    });
    expect(appendTagToContent(doc, "work", "richText")).toBe(doc);
  });
});

describe("removeTagFromContent", () => {
  it("移除 Markdown 正文中的标签并保留其余内容", () => {
    expect(removeTagFromContent("正文 #tag 继续", "tag", "markdown")).toBe("正文 继续");
    expect(removeTagFromContent("#tag", "tag", "markdown")).toBe("");
    expect(removeTagFromContent("上文\n#tag\n下文", "tag", "markdown")).toBe("上文\n\n下文");
  });

  it("不把 ##tag 删成 #（前置边界修复）", () => {
    expect(removeTagFromContent("##tag", "tag", "markdown")).toBe("##tag");
    expect(removeTagFromContent("标题 ##tag 正文 #tag", "tag", "markdown")).toBe("标题 ##tag 正文");
  });

  it("不误删代码块 / 行内代码里的 #tag", () => {
    const fenced = "```\n##tag\n```\n\n正文 #tag";
    expect(removeTagFromContent(fenced, "tag", "markdown")).toBe("```\n##tag\n```\n\n正文");
    expect(removeTagFromContent("示例 `#tag` 引用 #tag", "tag", "markdown")).toBe("示例 `#tag` 引用");
  });

  it("无匹配标签时原样返回", () => {
    expect(removeTagFromContent("正文 #other", "tag", "markdown")).toBe("正文 #other");
  });

  it("移除富文本 JSON 中的标签节点并保留其余文本", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "正文 #tag 继续" }] },
        { type: "paragraph", content: [{ type: "text", text: "#tag" }] },
      ],
    });
    const parsed = JSON.parse(removeTagFromContent(doc, "tag", "richText"));
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0].content[0].text).toBe("正文 继续");
  });

  it("富文本中 ##tag 不会被腐蚀成 #", () => {
    const doc = JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "##tag 正文" }] }],
    });
    const parsed = JSON.parse(removeTagFromContent(doc, "tag", "richText"));
    expect(parsed.content[0].content[0].text).toBe("##tag 正文");
  });
});
