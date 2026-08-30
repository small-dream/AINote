import { describe, expect, it } from "vitest";
import { normalizeNotePath } from "./path";

describe("normalizeNotePath", () => {
  it("补全 .md 后缀", () => {
    expect(normalizeNotePath("daily/note")).toBe("daily/note.md");
  });

  it("保留已有 .md 后缀", () => {
    expect(normalizeNotePath("a.md")).toBe("a.md");
  });

  it("去首尾斜杠", () => {
    expect(normalizeNotePath("/daily/note/")).toBe("daily/note.md");
  });

  it("空输入返回 null", () => {
    expect(normalizeNotePath("   ")).toBeNull();
  });
});
