import { describe, expect, it } from "vitest";
import { noteDisplayName } from "./displayName";

describe("noteDisplayName", () => {
  it("隐藏 Markdown 和富文本扩展名", () => {
    expect(noteDisplayName("Test.md")).toBe("Test");
    expect(noteDisplayName("Test.ainote")).toBe("Test");
  });

  it("保留普通名称和路径中的点号", () => {
    expect(noteDisplayName("v1.0/设计稿")).toBe("v1.0/设计稿");
    expect(noteDisplayName("README.txt")).toBe("README.txt");
  });
});
