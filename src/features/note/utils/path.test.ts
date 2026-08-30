import { describe, expect, it } from "vitest";
import { joinNotePath, normalizeNotePath } from "./path";

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

describe("joinNotePath", () => {
  it("目录非空时拼接", () => {
    expect(joinNotePath("daily", "2026-08-30.md")).toBe("daily/2026-08-30.md");
  });

  it("目录为空直接返回文件名", () => {
    expect(joinNotePath("", "未命名.md")).toBe("未命名.md");
  });

  it("去目录首尾斜杠", () => {
    expect(joinNotePath("/daily/", "a.md")).toBe("daily/a.md");
  });
});
