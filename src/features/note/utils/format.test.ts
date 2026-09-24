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

/** 给定文档与光标位置的激活格式集合。 */
function activeFormatsOf(doc: string, pos: number): Set<string> {
  const state = EditorState.create({
    doc,
    selection: { anchor: pos },
    extensions: [markdown({ extensions: [GFM] })],
  });
  return getActiveFormats(state);
}

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

  it("空光标已在格式内时取消格式，不插入空标记对", () => {
    expect(run("**hello**", 4, 4, inline("bold"))).toEqual({ doc: "hello", anchor: 2, head: 2 });
    expect(run("~~hello~~", 4, 4, inline("strikethrough"))).toEqual({ doc: "hello", anchor: 2, head: 2 });
  });

  it("空光标在斜体标记内按加粗仍按原逻辑包裹", () => {
    expect(run("*hello*", 3, 3, inline("bold"))).toEqual({ doc: "*he****llo*", anchor: 5, head: 5 });
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

  // 工具栏高亮与按钮语义必须一致：高亮时按下 = 取消该格式。边界（行首/行尾、紧贴标记）
  // 是光标常停的位置，此前解析落到文档根节点，会一边不高亮、一边插入一对空标记。
  it("边界处高亮态与按钮语义一致：高亮时按下即取消，不产生空标记对", () => {
    for (const doc of ["**b** x", "x **b**", "**b**"]) {
      for (let pos = 0; pos <= doc.length; pos++) {
        if (!activeFormatsOf(doc, pos).has("bold")) continue;
        const r = run(doc, pos, pos, inline("bold"));
        expect(r.doc).not.toContain("****");
      }
    }
  });

  it("加粗行首按下加粗取消格式，而不是留下空标记对", () => {
    expect(run("**b** x", 0, 0, inline("bold")).doc).toBe("b x");
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

  it("设置与替换 H4-H6", () => {
    expect(run("title", 0, 0, (s) => setHeading(s, 4)).doc).toBe("#### title");
    expect(run("### t", 0, 5, (s) => setHeading(s, 6)).doc).toBe("###### t");
    expect(run("##### t", 0, 7, (s) => setHeading(s, 1)).doc).toBe("# t");
  });

  // 光标停在旧 `#` 标记里（软渲染下用户很容易点到淡显的标记）时，默认映射会把光标
  // 丢到行首，行首不在 ATXHeading 节点内，工具栏于是退回「正文」。
  it("光标落在标记内或行首时，改级别后停在标题文字起点", () => {
    const level6 = run("#### 四级标题", 2, 2, (s) => setHeading(s, 6));
    expect(level6.doc).toBe("###### 四级标题");
    expect(level6.anchor).toBe(7);
    expect(activeFormatsOf(level6.doc, level6.anchor).has("h6")).toBe(true);

    const fromStart = run("#### 四级标题", 0, 0, (s) => setHeading(s, 6));
    expect(fromStart.anchor).toBe(7);

    const demote = run("#### 四级标题", 0, 0, (s) => setHeading(s, 0));
    expect(demote.doc).toBe("四级标题");
    expect(demote.anchor).toBe(0);
  });

  it("光标停在标题文字中时保留行内相对位置", () => {
    const r = run("#### 四级标题", 8, 8, (s) => setHeading(s, 6));
    expect(r.doc).toBe("###### 四级标题");
    expect(r.anchor).toBe(10);
  });

  it("多行选区与未变更时不动选区", () => {
    const multi = run("# 一\n## 二", 0, 8, (s) => setHeading(s, 4));
    expect(multi.doc).toBe("#### 一\n#### 二");

    // 已处于目标级别且光标在文字中：没有变更，保持选区不动
    const same = run("#### 四级标题", 8, 8, (s) => setHeading(s, 4));
    expect(same.doc).toBe("#### 四级标题");
    expect(same.anchor).toBe(8);
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
    expect(activeAt("#### t", 5).has("h4")).toBe(true);
    expect(activeAt("##### t", 6).has("h5")).toBe(true);
    expect(activeAt("###### t", 7).has("h6")).toBe(true);
  });

  // 块边界（行首 / 行尾）是光标最常见的停留位置：解析落到文档根节点会让工具栏
  // 在该处丢掉全部格式，标题显示成「正文」、列表/引用同理。
  it("标题行首与行尾仍判定为标题", () => {
    expect(activeAt("#### t\n", 0).has("h4")).toBe(true);
    expect(activeAt("#### t\n", 6).has("h4")).toBe(true);
    expect(activeAt("#### t", 6).has("h4")).toBe(true);
    expect(activeAt("#### t\n\n", 6).has("h4")).toBe(true);
    expect(activeAt("x\n#### t\n", 2).has("h4")).toBe(true);
  });

  it("列表与引用行首、行尾仍判定为对应格式", () => {
    expect(activeAt("- item\n", 0).has("bulletList")).toBe(true);
    expect(activeAt("- item\n", 6).has("bulletList")).toBe(true);
    expect(activeAt("1. item\n", 7).has("orderedList")).toBe(true);
    expect(activeAt("> q\n", 0).has("quote")).toBe(true);
    expect(activeAt("> q\n", 3).has("quote")).toBe(true);
  });

  it("空行与纯正文行不误判为相邻块的格式", () => {
    expect(activeAt("# t\n\n", 4).size).toBe(0);
    expect(activeAt("para\n# t\n", 4).size).toBe(0);
    expect(activeAt("plain\n", 0).size).toBe(0);
    expect(activeAt("plain\n", 5).size).toBe(0);
  });

  it("纯正文无激活格式", () => {
    expect(activeAt("plain", 2).size).toBe(0);
  });
});
