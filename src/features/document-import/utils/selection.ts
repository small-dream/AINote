import { documentFormatOf, isMarkdownFile, isUnsupportedWordFile } from "../types";

export type NoteImportSelection =
  | { kind: "markdown"; files: File[] }
  | { kind: "document"; file: File }
  | { kind: "invalid"; code: "unsupported" | "oneAtATime" | "desktopOnly" };

/** 统一导入入口的文件分流：Markdown 可批量，PDF / Word 单次仅一个且不可混选。 */
export function selectNoteImport(files: readonly File[], mobile: boolean): NoteImportSelection {
  if (files.some((file) => isUnsupportedWordFile(file.name))) return { kind: "invalid", code: "unsupported" };
  const markdownFiles = files.filter((file) => isMarkdownFile(file.name));
  const documentFiles = files.filter((file) => documentFormatOf(file.name) !== null);
  if (markdownFiles.length + documentFiles.length !== files.length) return { kind: "invalid", code: "unsupported" };
  if (documentFiles.length > 0) {
    if (documentFiles.length > 1 || markdownFiles.length > 0) return { kind: "invalid", code: "oneAtATime" };
    if (mobile) return { kind: "invalid", code: "desktopOnly" };
    return { kind: "document", file: documentFiles[0] as File };
  }
  return { kind: "markdown", files: markdownFiles };
}
