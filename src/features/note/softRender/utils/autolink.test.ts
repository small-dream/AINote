import { describe, expect, it } from "vitest";
import { findAutolinks } from "./autolink";
import { createRangeIndex } from "./ranges";

describe("findAutolinks", () => {
  it("识别 URL 与邮箱", () => {
    const doc = "visit https://example.com or mailto:me@example.com";
    const links = findAutolinks(doc, createRangeIndex([]));
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ href: "https://example.com" });
    expect(links[1]).toMatchObject({ href: "mailto:me@example.com" });
  });

  it("跳过受保护区间", () => {
    const doc = "`https://skip.com` https://keep.com";
    const links = findAutolinks(doc, createRangeIndex([{ from: 0, to: 20 }]));
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ href: "https://keep.com" });
  });
});
