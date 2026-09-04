import { describe, expect, it } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import {
  backlinkContextsOf,
  buildTagCloud,
  findBacklinks,
  noteTitle,
  resolveWikiTarget,
  tagsOf,
  wikiCreatePath,
  wikiNameOf,
} from "./wiki";

const NOTES: NoteWikiDto[] = [
  { path: "a.md", title: "A 笔记", tags: ["x", "y"], links: ["B 笔记"] },
  { path: "sub/b.md", title: "B 笔记", tags: ["y"], links: ["A 笔记", "missing"] },
  { path: "c.md", title: "C 笔记", tags: ["x"], links: ["A 笔记"] },
];

describe("wikiNameOf", () => {
  it("取文件名去 .md，忽略目录", () => {
    expect(wikiNameOf("daily/我的笔记.md")).toBe("我的笔记");
    expect(wikiNameOf("a.md")).toBe("a");
    expect(wikiNameOf("noext")).toBe("noext");
  });
});

describe("buildTagCloud", () => {
  it("按计数降序、名称升序聚合", () => {
    expect(buildTagCloud(NOTES)).toEqual([
      { name: "x", count: 2 },
      { name: "y", count: 2 },
    ]);
  });

  it("空仓库返回空列表", () => {
    expect(buildTagCloud([])).toEqual([]);
  });
});

describe("resolveWikiTarget", () => {
  it("按文件名忽略大小写与目录解析", () => {
    expect(resolveWikiTarget(NOTES, "b 笔记")).toBe("sub/b.md");
    expect(resolveWikiTarget(NOTES, "A")).toBe("a.md");
    expect(resolveWikiTarget(NOTES, "B")).toBe("sub/b.md");
  });

  it("不存在返回 null", () => {
    expect(resolveWikiTarget(NOTES, "missing")).toBeNull();
    expect(resolveWikiTarget(NOTES, "")).toBeNull();
  });
});

describe("findBacklinks", () => {
  it("返回指向目标笔记的其余笔记", () => {
    const backlinks = findBacklinks(NOTES, "a.md");
    expect(backlinks.map((n) => n.path)).toEqual(["sub/b.md", "c.md"]);
  });

  it("无反链返回空", () => {
    expect(findBacklinks(NOTES, "c.md")).toEqual([]);
  });
});

describe("noteTitle / tagsOf", () => {
  it("按路径取标题与标签", () => {
    expect(noteTitle(NOTES, "a.md")).toBe("A 笔记");
    expect(noteTitle(NOTES, "missing.md")).toBe("missing");
    expect(tagsOf(NOTES, "a.md")).toEqual(["x", "y"]);
    expect(tagsOf(NOTES, "missing.md")).toEqual([]);
  });
});

describe("backlinkContextsOf", () => {
  const notes = [
    { path: "a.md", title: "A", tags: [], links: ["B"], linkContexts: [
      { target: "B", line: 2, snippet: "见 [[B]] 前文" },
      { target: "B", line: 9, snippet: "再次 [[B]]" },
      { target: "C", line: 4, snippet: "其它 [[C]]" },
    ] },
    { path: "b.md", title: "B", tags: [], links: [], linkContexts: [] },
  ] as NoteWikiDto[];

  it("返回解析到目标的多条上下文并带行号", () => {
    expect(backlinkContextsOf(notes[0] as NoteWikiDto, notes, "b.md")).toEqual([
      { line: 2, snippet: "见 [[B]] 前文" },
      { line: 9, snippet: "再次 [[B]]" },
    ]);
  });

  it("无指向目标的上下文时返回空数组", () => {
    expect(backlinkContextsOf(notes[1] as NoteWikiDto, notes, "b.md")).toEqual([]);
  });
});

describe("wikiCreatePath", () => {
  it("生成 .md 路径并保留目录", () => {
    expect(wikiCreatePath("我的笔记")).toBe("我的笔记.md");
    expect(wikiCreatePath("daily/计划")).toBe("daily/计划.md");
    expect(wikiCreatePath("已有.md")).toBe("已有.md");
  });

  it("清理非法字符与空段", () => {
    expect(wikiCreatePath("a:b?c*d")).toBe("a-b-c-d.md");
    expect(wikiCreatePath("/  /")).toBe("untitled.md");
  });
});
