import { describe, expect, it } from "vitest";
import { splitFrontmatter, upsertFrontmatterSummary } from "./frontmatter";

describe("splitFrontmatter", () => {
  it("拆出已有 frontmatter 与正文", () => {
    const parts = splitFrontmatter("---\ntitle: 标题\n---\n\n正文内容");
    expect(parts.frontmatter).toBe("title: 标题");
    expect(parts.body).toContain("正文内容");
  });

  it("无 frontmatter 时 frontmatter 为 null", () => {
    const parts = splitFrontmatter("正文内容");
    expect(parts.frontmatter).toBeNull();
    expect(parts.body).toBe("正文内容");
  });
});

describe("upsertFrontmatterSummary", () => {
  it("已有 frontmatter 时更新 summary 并保留正文", () => {
    const out = upsertFrontmatterSummary("---\ntitle: 标题\n---\n\n正文内容", "一段摘要");
    expect(out).toContain("summary: 一段摘要");
    expect(out).toContain("title: 标题");
    expect(out).toContain("正文内容");
  });

  it("无 frontmatter 时新增 summary 块", () => {
    const out = upsertFrontmatterSummary("正文内容", "摘要");
    expect(out.startsWith("---\nsummary: 摘要\n---")).toBe(true);
    expect(out).toContain("正文内容");
  });

  it("重复调用覆盖旧 summary", () => {
    const once = upsertFrontmatterSummary("正文", "第一版");
    const twice = upsertFrontmatterSummary(once, "第二版");
    expect(twice).toContain("summary: 第二版");
    expect(twice).not.toContain("第一版");
  });
});
