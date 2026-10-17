import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import { buildCompletions, getCompletionContext } from "./completion";

const notes: NoteWikiDto[] = [
  { path: "guide.md", title: "指南", aliases: ["手册"], headings: [{ text: "快速开始", level: 1, line: 3 }], tags: ["写作", "产品"], links: [] },
  { path: "plan.md", title: "项目计划", aliases: [], headings: [{ text: "目标", level: 1, line: 1 }, { text: "里程碑", level: 2, line: 8 }], tags: ["产品"], links: [] },
];

describe("markdown completion", () => {
  it("识别双链上下文并从查询词开始替换", () => {
    const state = EditorState.create({ doc: "参见 [[项目", selection: { anchor: 7 } });
    const context = getCompletionContext(state);
    expect(context).toEqual({ kind: "wiki", query: "项目", from: 5 });
    if (!context) throw new Error("missing completion context");
    expect(buildCompletions(notes, context).map((item) => item.label)).toEqual(["项目计划"]);
  });

  it("输入 [[笔记# 后补全该笔记标题", () => {
    const state = EditorState.create({ doc: "参见 [[项目计划#里", selection: { anchor: 11 } });
    const context = getCompletionContext(state);
    expect(context).toMatchObject({ kind: "wiki", query: "里", wikiNote: "项目计划" });
    if (!context) throw new Error("missing completion context");
    expect(buildCompletions(notes, context).map((item) => item.label)).toEqual(["里程碑"]);
  });

  it("识别标签且忽略标题语法", () => {
    expect(getCompletionContext(EditorState.create({ doc: "标签 #产", selection: { anchor: 5 } }))).toMatchObject({ kind: "tag", query: "产" });
    expect(getCompletionContext(EditorState.create({ doc: "# 标题", selection: { anchor: 4 } }))).toBeNull();
  });
});
