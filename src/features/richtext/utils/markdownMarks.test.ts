import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "./extensions";
import { escapeHtml, matchTag, matchWikiLink, registerTagMarkdown, registerWikiLinkMarkdown, type MarkdownItLike, type MarkdownInlineRule } from "./markdownMarks";

function createTestEditor(markdown: string) {
  const element = document.createElement("div");
  return new Editor({ element, extensions: createRichTextExtensions(null), content: markdown });
}

describe("matchWikiLink", () => {
  it("匹配纯目标与别名形式", () => {
    expect(matchWikiLink("[[项目计划]]", 0)).toEqual({ raw: "[[项目计划]]", target: "项目计划", alias: null });
    expect(matchWikiLink("[[A|别名]]", 0)).toEqual({ raw: "[[A|别名]]", target: "A", alias: "别名" });
  });

  it("从中间位置匹配并定位结尾", () => {
    const match = matchWikiLink("前缀 [[a]] 后缀", 3);
    expect(match?.raw).toBe("[[a]]");
  });

  it("拒绝未闭合、空目标、换行与嵌套方括号", () => {
    expect(matchWikiLink("[[abc", 0)).toBeNull();
    expect(matchWikiLink("[[]]", 0)).toBeNull();
    expect(matchWikiLink("[[ ]]", 0)).toBeNull();
    expect(matchWikiLink("[[a\nb]]", 0)).toBeNull();
    expect(matchWikiLink("[[a[b]]", 0)).toBeNull();
  });
});

describe("matchTag", () => {
  it("匹配行首与空白后的标签", () => {
    expect(matchTag("#项目", 0)).toEqual({ raw: "#项目", tag: "项目" });
    expect(matchTag("正文 #bug 结尾", 3)).toEqual({ raw: "#bug", tag: "bug" });
    expect(matchTag("x #sub/tag", 2)).toEqual({ raw: "#sub/tag", tag: "sub/tag" });
  });

  it("拒绝非空白前缀、# 后空格与空标签", () => {
    expect(matchTag("abc#tag", 3)).toBeNull();
    expect(matchTag("# 标题", 0)).toBeNull();
    expect(matchTag("##", 0)).toBeNull();
  });
});

describe("escapeHtml", () => {
  it("转义 HTML 特殊字符", () => {
    expect(escapeHtml('<a "&" >')).toBe("&lt;a &quot;&amp;&quot; &gt;");
  });
});

describe("markdown-it 规则注册", () => {
  function createMarkdownItLike() {
    const rules: Record<string, MarkdownInlineRule> = {};
    const renderers: Record<string, (tokens: never[], index: number) => string> = {};
    const markdownit: MarkdownItLike = {
      inline: { ruler: { before: (_name, ruleName, rule) => { rules[ruleName] = rule; } } },
      renderer: { rules: renderers as unknown as MarkdownItLike["renderer"]["rules"] },
    };
    return { markdownit, rules, renderers };
  }

  it("wiki 规则注册命名并挂接渲染器", () => {
    const { markdownit, rules, renderers } = createMarkdownItLike();
    registerWikiLinkMarkdown(markdownit);
    expect(typeof rules.ainote_wiki_link).toBe("function");
    expect(typeof renderers.ainote_wiki_link).toBe("function");
  });

  it("tag 规则注册命名并挂接渲染器", () => {
    const { markdownit, rules, renderers } = createMarkdownItLike();
    registerTagMarkdown(markdownit);
    expect(typeof rules.ainote_tag).toBe("function");
    expect(typeof renderers.ainote_tag).toBe("function");
  });
});

describe("存量 Markdown 双链/标签解析为 mark", () => {
  it("[[双链]] 转换后带 wikiLink mark 与目标属性", () => {
    const editor = createTestEditor("见 [[项目计划]] 与 [[A|别名]]");
    const paragraph = editor.getJSON().content?.[0];
    const marks = (paragraph?.content ?? []).flatMap((node) => node.marks ?? []);
    const wiki = marks.filter((mark) => mark.type === "wikiLink");
    expect(wiki).toHaveLength(2);
    expect(wiki[0]?.attrs).toMatchObject({ target: "项目计划", alias: null });
    expect(wiki[1]?.attrs).toMatchObject({ target: "A", alias: "别名" });
    editor.destroy();
  });

  it("#标签 转换后带 tag mark", () => {
    const editor = createTestEditor("正文 #bug 与 #项目/子页");
    const paragraph = editor.getJSON().content?.[0];
    const tags = ((paragraph?.content ?? []).flatMap((node) => node.marks ?? [])).filter((mark) => mark.type === "tag");
    expect(tags.map((mark) => mark.attrs?.tag)).toEqual(["bug", "项目/子页"]);
    editor.destroy();
  });

  it("渲染 DOM 携带 data-wiki-target / data-tag 供点击委托", () => {
    const editor = createTestEditor("见 [[目标]] 和 #标签");
    const html = editor.view.dom.innerHTML;
    expect(html).toContain('data-wiki-target="目标"');
    expect(html).toContain('data-tag="标签"');
    editor.destroy();
  });
});

describe("富文本 → Markdown 序列化", () => {
  it("双链 mark 输出 [[原文]] 而非 span 噪音", () => {
    const editor = createTestEditor("见 [[项目计划]] 与 [[A|别名]]");
    const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
    expect(markdown).toContain("[[项目计划]]");
    expect(markdown).toContain("[[A|别名]]");
    expect(markdown).not.toContain("data-wiki-target");
    expect(markdown).not.toContain("<span");
    editor.destroy();
  });

  it("标签 mark 输出 #原文 而非 span 噪音", () => {
    const editor = createTestEditor("正文 #bug 结尾");
    const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
    expect(markdown).toContain("#bug");
    expect(markdown).not.toContain("data-tag");
    expect(markdown).not.toContain("<span");
    editor.destroy();
  });

  it("行内代码等保留默认转义，不受 escape:false 影响", () => {
    const editor = createTestEditor("`[[x]]` 与 [[y]]");
    const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
    expect(markdown).toContain("`[[x]]`");
    expect(markdown).toContain("[[y]]");
    editor.destroy();
  });
});
