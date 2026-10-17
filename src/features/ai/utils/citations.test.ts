import { describe, expect, it } from "vitest";
import type { ContextSnippet } from "@/api/types";
import { citedIndices, citedSnippets } from "./citations";

const citations: ContextSnippet[] = [1, 2, 3].map((index) => ({
  index, path: `note-${index}.md`, heading: null, line: index, text: "正文",
}));

describe("AI citations", () => {
  it("只保留回答实际出现且存在的编号", () => {
    expect(citedIndices("依据 [2] 与 [9]，另见 [2]", citations)).toEqual([2]);
    expect(citedSnippets("依据 [2]", citations).map((item) => item.path)).toEqual(["note-2.md"]);
  });

  it("漏标时返回空数组", () => {
    expect(citedSnippets("没有编号", citations)).toEqual([]);
  });
});
