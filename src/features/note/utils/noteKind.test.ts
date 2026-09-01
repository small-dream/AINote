import { describe, expect, it } from "vitest";
import { isRichTextPath, noteExtension, noteKindOfPath, swapNoteExtension } from "./noteKind";

describe("noteKind", () => {
  it("noteExtension 按类型返回扩展名", () => {
    expect(noteExtension("markdown")).toBe("md");
    expect(noteExtension("richText")).toBe("ainote");
  });

  it("noteKindOfPath 按扩展名判定", () => {
    expect(noteKindOfPath("a.md")).toBe("markdown");
    expect(noteKindOfPath("daily/x.ainote")).toBe("richText");
    expect(noteKindOfPath("X.AINOTE")).toBe("richText");
    expect(noteKindOfPath("noext")).toBe("markdown");
  });

  it("isRichTextPath 区分富文本", () => {
    expect(isRichTextPath("a.ainote")).toBe(true);
    expect(isRichTextPath("a.md")).toBe(false);
  });

  it("swapNoteExtension 切换类型扩展名", () => {
    expect(swapNoteExtension("daily/a.md", "richText")).toBe("daily/a.ainote");
    expect(swapNoteExtension("daily/a.ainote", "markdown")).toBe("daily/a.md");
    expect(swapNoteExtension("a.MD", "richText")).toBe("a.ainote");
  });
});
