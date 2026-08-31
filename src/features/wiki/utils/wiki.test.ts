import { describe, expect, it } from "vitest";
import type { NoteWikiDto } from "@/api/types";
import {
  buildTagCloud,
  findBacklinks,
  noteTitle,
  resolveWikiTarget,
  tagsOf,
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
