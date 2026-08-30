import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  getActiveFormats,
  setHeading,
  toggleBlock,
  toggleInline,
  type FormatResult,
} from "./format";

type FormatFn = (s: EditorState) => FormatResult;

/** 构造 state、应用格式化结果，返回新文档与选区 */
function run(doc: string, from: number, to: number, fn: FormatFn) {
  const state = EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [markdown({ extensions: [GFM] })],
  });
  const r = fn(state);
  const next = state.update({
    changes: r.changes,
    ...(r.selection ? { selection: r.selection } : {}),
  }).state;
  return {
    doc: next.doc.toString(),
    anchor: next.selection.main.anchor,
    head: next.selection.main.head,
  };
}

const inline = (format: "bold" | "italic" | "strikethrough" | "code") => {
  const fn: FormatFn = (s) => toggleInline(s, format);
  return fn;
};

describe("toggleInline", () => {
  it("包裹选区并调整选区", () => {
    expect(run("hello world", 0, 5, inline("bold"))).toEqual({
      doc: "**hello** world",
      anchor: 2,
      head: 7,
    });
  });

  it("空选区插入一对标记、光标居中", () => {
    expect(run("ab", 1, 1, inline("code"))).toEqual({ doc: "a``b", anchor: 2, head: 2 });
  });

  it("选区外侧有标记时去除标记", () => {
    expect(run("**hello**", 2, 7, inline("bold"))).toEqual({ doc: "hello", anchor: 0, head: 5 });
  });

  it("选区自身包含标记时去除标记", () => {
    expect(run("**hello**", 0, 9, inline("bold"))).toEqual({ doc: "hello", anchor: 0, head: 5 });
  });

  it("光标位于空标记对中时去除标记", () => {
    expect(run("a****b", 3, 3, inline("bold"))).toEqual({ doc: "ab", anchor: 1, head: 1 });
  });

  it("斜体不会把加粗的 ** 当作单个 * 去除", () => {
    expect(run("**b**", 2, 3, inline("italic"))).toEqual({ doc: "***b***", anchor: 3, head: 4 });
  });

  it("斜体包裹与去除", () => {
    expect(run("*it*", 1, 3, inline("italic"))).toEqual({ doc: "it", anchor: 0, head: 2 });
    expect(run("it", 0, 2, inline("italic"))).toEqual({ doc: "*it*", anchor: 1, head: 3 });
  });

  it("删除线包裹与去除", () => {
    expect(run("~~s~~", 2, 3, inline("strikethrough"))).toEqual({ doc: "s", anchor: 0, head: 1 });
  });
});

describe("toggleBlock", () => {
  it("批量添加引用前缀", () => {
    const r = run("a\nb", 0, 3, (s) => toggleBlock(s, "quote"));
    expect(r.doc).toBe("> a\n> b");
  });

  it("全部已有前缀时批量去除", () => {
    const r = run("> a\n> b", 0, 5, (s) => toggleBlock(s, "quote"));
    expect(r.doc).toBe("a\nb");
  });

  it("部分行有前缀时统一添加", () => {
    const r = run("- a\nb", 0, 4, (s) => toggleBlock(s, "bullet"));
    expect(r.doc).toBe("- - a\n- b");
  });

  it("有序列表按行递增编号", () => {
    const r = run("a\nb\nc", 0, 5, (s) => toggleBlock(s, "ordered"));
    expect(r.doc).toBe("1. a\n2. b\n3. c");
  });

  it("去除有序列表任意编号前缀", () => {
    const r = run("3. a\n7. b", 0, 8, (s) => toggleBlock(s, "ordered"));
    expect(r.doc).toBe("a\nb");
  });

  it("任务列表添加与去除", () => {
    const r = run("a", 0, 1, (s) => toggleBlock(s, "task"));
    expect(r.doc).toBe("- [ ] a");
    expect(run("- [x] a", 0, 7, (s) => toggleBlock(s, "task")).doc).toBe("a");
  });
});

describe("setHeading", () => {
  it("正文设置为 H2", () => {
    expect(run("title", 0, 0, (s) => setHeading(s, 2)).doc).toBe("## title");
  });

  it("替换已有标题级别", () => {
    expect(run("# t", 0, 3, (s) => setHeading(s, 3)).doc).toBe("### t");
  });

  it("正文级别去除 # 前缀", () => {
    expect(run("## t\n## u", 0, 9, (s) => setHeading(s, 0)).doc).toBe("t\nu");
  });

  it("正文行选择正文级别不产生变更", () => {
    expect(run("t", 0, 0, (s) => setHeading(s, 0)).doc).toBe("t");
  });
});

describe("getActiveFormats", () => {
  const activeAt = (doc: string, pos: number) => {
    const state = EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [markdown({ extensions: [GFM] })],
    });
    return getActiveFormats(state);
  };

  it("检测行内格式", () => {
    expect(activeAt("**b**", 3).has("bold")).toBe(true);
    expect(activeAt("*i*", 2).has("italic")).toBe(true);
    expect(activeAt("~~s~~", 3).has("strikethrough")).toBe(true);
    expect(activeAt("`c`", 2).has("code")).toBe(true);
  });

  it("检测块级格式", () => {
    expect(activeAt("> q", 2).has("quote")).toBe(true);
    const task = activeAt("- [ ] t", 6);
    expect(task.has("task")).toBe(true);
    expect(task.has("bulletList")).toBe(true);
    expect(activeAt("1. o", 3).has("orderedList")).toBe(true);
    expect(activeAt("- b", 2).has("bulletList")).toBe(true);
  });

  it("检测标题级别", () => {
    expect(activeAt("# t", 2).has("h1")).toBe(true);
    expect(activeAt("## t", 3).has("h2")).toBe(true);
    expect(activeAt("### t", 4).has("h3")).toBe(true);
  });

  it("纯正文无激活格式", () => {
    expect(activeAt("plain", 2).size).toBe(0);
  });
});
