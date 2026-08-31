import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import { buildCompletions, getCompletionContext } from "./completion";

const notes: NoteWikiDto[] = [
  { path: "guide.md", title: "指南", tags: ["写作", "产品"], links: [] },
  { path: "plan.md", title: "项目计划", tags: ["产品"], links: [] },
];

describe("markdown completion", () => {
  it("识别双链上下文并从查询词开始替换", () => {
    const state = EditorState.create({ doc: "参见 [[项目", selection: { anchor: 7 } });
    const context = getCompletionContext(state);
    expect(context).toEqual({ kind: "wiki", query: "项目", from: 5 });
    if (!context) throw new Error("missing completion context");
    expect(buildCompletions(notes, context).map((item) => item.label)).toEqual(["项目计划"]);
  });

  it("识别标签且忽略标题语法", () => {
    expect(getCompletionContext(EditorState.create({ doc: "标签 #产", selection: { anchor: 5 } }))).toMatchObject({ kind: "tag", query: "产" });
    expect(getCompletionContext(EditorState.create({ doc: "# 标题", selection: { anchor: 4 } }))).toBeNull();
  });
});
