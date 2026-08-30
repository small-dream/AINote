import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { FormatResult } from "./format";
import { insertCodeBlock, insertDivider, insertImage, insertLink, insertTable } from "./insert";

type InsertFn = (s: EditorState) => FormatResult;

function run(doc: string, from: number, to: number, fn: InsertFn) {
  const state = EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [markdown({ extensions: [GFM] })],
  });
  const r = fn(state);
  const next = state.update({ changes: r.changes, selection: r.selection }).state;
  return {
    doc: next.doc.toString(),
    anchor: next.selection.main.anchor,
    head: next.selection.main.head,
  };
}

describe("insertLink", () => {
  it("有选区包成链接并选中 url 占位符", () => {
    expect(run("文字", 0, 2, (s) => insertLink(s))).toEqual({
      doc: "[文字](url)",
      anchor: 5,
      head: 8,
    });
  });

  it("无选区插入模板并选中文字占位符", () => {
    expect(run("", 0, 0, (s) => insertLink(s))).toEqual({
      doc: "[文字](url)",
      anchor: 1,
      head: 3,
    });
  });

  it("提供 URL 时自动填充、光标置于链接后", () => {
    expect(run("a", 0, 1, (s) => insertLink(s, "https://x.com"))).toEqual({
      doc: "[a](https://x.com)",
      anchor: 18,
      head: 18,
    });
  });
});

describe("insertImage", () => {
  it("插入模板并选中 alt", () => {
    expect(run("ab", 1, 1, insertImage)).toEqual({
      doc: "a![alt]()b",
      anchor: 3,
      head: 6,
    });
  });
});

describe("insertCodeBlock", () => {
  it("无选区插入空代码块、光标居中", () => {
    expect(run("", 0, 0, insertCodeBlock)).toEqual({
      doc: "```\n\n```",
      anchor: 4,
      head: 4,
    });
  });

  it("有选区时包裹", () => {
    expect(run("code", 0, 4, insertCodeBlock)).toEqual({
      doc: "```\ncode\n```",
      anchor: 12,
      head: 12,
    });
  });
});

describe("insertTable", () => {
  it("插入模板、光标落到第一个数据单元格", () => {
    const r = run("", 0, 0, insertTable);
    expect(r.doc).toBe("| 列1 | 列2 |\n| --- | --- |\n|  |  |");
    expect(r.doc.slice(r.anchor)).toBe(" |  |");
  });
});

describe("insertDivider", () => {
  it("在当前行下方插入分割线", () => {
    const r = run("line1\nline2", 2, 2, insertDivider);
    expect(r.doc).toBe("line1\n\n---\n\nline2");
    expect(r.anchor).toBe(11);
  });
});
