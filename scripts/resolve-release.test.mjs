import { describe, expect, it } from "vitest";
import { createRelease, releaseName, selectRelease } from "./resolve-release.mjs";

const draft = (id, tagName) => ({ id, draft: true, name: releaseName("v1.2.3"), tag_name: tagName });

describe("selectRelease", () => {
  it("优先命中 tag_name 完全匹配的 Release", () => {
    const target = { id: 1, draft: true, name: releaseName("v1.2.3"), tag_name: "v1.2.3" };
    const orphan = draft(2, "untagged-abc");
    expect(selectRelease([orphan, target], "v1.2.3")).toEqual({ release: target, orphaned: false });
  });

  it("匹配不到时回退到同名孤立草稿并标记需要修复", () => {
    const orphan = draft(2, "untagged-abc");
    expect(selectRelease([orphan], "v1.2.3")).toEqual({ release: orphan, orphaned: true });
  });

  it("忽略非草稿或名称不匹配的 untagged Release", () => {
    const published = { id: 3, draft: false, name: releaseName("v1.2.3"), tag_name: "untagged-abc" };
    const otherName = { id: 4, draft: true, name: releaseName("v9.9.9"), tag_name: "untagged-def" };
    expect(selectRelease([published, otherName], "v1.2.3")).toEqual({ release: null, orphaned: false });
  });

  it("没有任何匹配时返回空", () => {
    expect(selectRelease([], "v1.2.3")).toEqual({ release: null, orphaned: false });
  });

  it("多个同 tag Release 时报错", () => {
    const releases = [
      { id: 1, draft: true, name: releaseName("v1.2.3"), tag_name: "v1.2.3" },
      { id: 2, draft: true, name: releaseName("v1.2.3"), tag_name: "v1.2.3" },
    ];
    expect(() => selectRelease(releases, "v1.2.3")).toThrow(/多个 tag/);
  });

  it("多个孤立草稿时报错", () => {
    const releases = [draft(1, "untagged-a"), draft(2, "untagged-b")];
    expect(() => selectRelease(releases, "v1.2.3")).toThrow(/多个孤立草稿/);
  });
});

describe("createRelease", () => {
  /** 模拟 gh：列表返回已有草稿，POST 抛错（CI 上出现过的「响应体为空」）。 */
  function failingRun(existing) {
    return (args) => {
      if (args[0].includes("?per_page=100")) {
        return existing.map((release) => JSON.stringify(release)).join("\n");
      }
      throw new Error("Command failed: gh api --method POST ... unexpected end of JSON input");
    };
  }

  it("创建成功时直接返回新 Release", () => {
    const run = () => JSON.stringify({ id: 42, tag_name: "v1.2.3" });
    expect(createRelease("o/r", "v1.2.3", "body", run)).toEqual({ id: 42, bodyApplied: true });
  });

  it("POST 报错但远端已存在草稿时复核成功，不再让流水线失败", () => {
    const existing = [{ id: 7, draft: true, name: releaseName("v1.2.3"), tag_name: "v1.2.3" }];
    expect(createRelease("o/r", "v1.2.3", "body", failingRun(existing))).toEqual({
      id: 7,
      bodyApplied: false,
    });
  });

  it("POST 报错且远端确实没有 Release 时仍然抛出原始错误", () => {
    expect(() => createRelease("o/r", "v1.2.3", "body", failingRun([]))).toThrow(/unexpected end of JSON input/);
  });
});
