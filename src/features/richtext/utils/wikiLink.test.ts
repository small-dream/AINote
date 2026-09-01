import { describe, expect, it } from "vitest";
import { parseWikiLink } from "./wikiLink";

describe("parseWikiLink", () => {
  it("解析纯目标", () => {
    expect(parseWikiLink("项目计划")).toEqual({ target: "项目计划", alias: null });
  });

  it("解析目标与别名", () => {
    expect(parseWikiLink("A|别名")).toEqual({ target: "A", alias: "别名" });
  });

  it("清理目标与别名空白", () => {
    expect(parseWikiLink("  A  |  别名 ")).toEqual({ target: "A", alias: "别名" });
  });

  it("只有管道分隔符时别名返回 null", () => {
    expect(parseWikiLink("A|")).toEqual({ target: "A", alias: null });
  });
});
