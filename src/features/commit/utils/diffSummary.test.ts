import { describe, expect, it } from "vitest";
import { summarizeDiff } from "./diffSummary";

describe("summarizeDiff", () => {
  it("统计新增与删除行，忽略上下文行", () => {
    expect(
      summarizeDiff([
        { kind: "context", text: "same" },
        { kind: "added", text: "new" },
        { kind: "removed", text: "old" },
        { kind: "added", text: "newer" },
      ]),
    ).toEqual({ added: 2, removed: 1 });
  });

  it("空 diff 返回 0 / 0", () => {
    expect(summarizeDiff([])).toEqual({ added: 0, removed: 0 });
  });
});
