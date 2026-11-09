import { describe, expect, it } from "vitest";
import { selectNoteImport } from "./selection";

function file(name: string): File {
  return new File([new Uint8Array([1])], name);
}

describe("selectNoteImport", () => {
  it("批量 Markdown 走原有导入链路", () => {
    const files = [file("a.md"), file("b.markdown")];
    const result = selectNoteImport(files, false);
    expect(result.kind).toBe("markdown");
    if (result.kind === "markdown") expect(result.files).toEqual(files);
  });

  it("桌面端允许单个 DOCX / PDF", () => {
    expect(selectNoteImport([file("报告.docx")], false)).toMatchObject({ kind: "document", file: { name: "报告.docx" } });
    expect(selectNoteImport([file("报告.PDF")], false)).toMatchObject({ kind: "document", file: { name: "报告.PDF" } });
  });

  it("文档与 Markdown 混合或多文档被拒绝", () => {
    expect(selectNoteImport([file("a.docx"), file("b.md")], false)).toEqual({ kind: "invalid", code: "oneAtATime" });
    expect(selectNoteImport([file("a.docx"), file("b.pdf")], false)).toEqual({ kind: "invalid", code: "oneAtATime" });
  });

  it("移动端拒绝文档，但仍允许 Markdown", () => {
    expect(selectNoteImport([file("a.docx")], true)).toEqual({ kind: "invalid", code: "desktopOnly" });
    expect(selectNoteImport([file("a.md")], true).kind).toBe("markdown");
  });

  it("旧版 Word 与未知格式被拒绝", () => {
    expect(selectNoteImport([file("a.doc")], false)).toEqual({ kind: "invalid", code: "unsupported" });
    expect(selectNoteImport([file("a.docm")], false)).toEqual({ kind: "invalid", code: "unsupported" });
    expect(selectNoteImport([file("a.txt")], false)).toEqual({ kind: "invalid", code: "unsupported" });
    expect(selectNoteImport([file("a.md"), file("a.txt")], false)).toEqual({ kind: "invalid", code: "unsupported" });
  });
});
