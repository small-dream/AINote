import { describe, expect, it } from "vitest";
import type { SearchResult } from "@/api/types";
import { buildSearchFacets, filterSearchResults, highlightSegments } from "./filters";

const result = (path: string, snippet = ""): SearchResult => ({
  path,
  title: path.split("/").at(-1) ?? path,
  snippet,
  line: 1,
  updatedAt: 1,
  encrypted: false,
});

describe("搜索筛选", () => {
  const results = [result("daily/a.md"), result("daily/sub/b.ainote"), result("docs/c.md")];

  it("按类型与目录筛选，目录包含子目录", () => {
    expect(filterSearchResults(results, { kind: "richText", directory: "" }).map((item) => item.path)).toEqual(["daily/sub/b.ainote"]);
    expect(filterSearchResults(results, { kind: "all", directory: "daily" }).map((item) => item.path)).toEqual(["daily/a.md", "daily/sub/b.ainote"]);
    expect(filterSearchResults(results, { kind: "markdown", directory: "daily/sub" })).toEqual([]);
  });

  it("目录选项包含所有祖先目录并排序", () => {
    expect(buildSearchFacets(results).directories).toEqual(["daily", "daily/sub", "docs"]);
    expect(buildSearchFacets([result("root.md")]).directories).toEqual([]);
  });
});

describe("搜索高亮", () => {
  it("不区分大小写切出多个命中片段", () => {
    expect(highlightSegments("Rust and rust", "rust")).toEqual([
      { text: "Rust", match: true },
      { text: " and ", match: false },
      { text: "rust", match: true },
    ]);
  });

  it("空查询或未命中时返回原文本", () => {
    expect(highlightSegments("正文", "")).toEqual([{ text: "正文", match: false }]);
    expect(highlightSegments("正文", "rust")).toEqual([{ text: "正文", match: false }]);
  });
});
