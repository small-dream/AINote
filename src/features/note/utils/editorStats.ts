/** 编辑器状态栏使用的纯数据；不依赖 CodeMirror / TipTap，便于跨编辑器复用与单测。 */
export interface EditorPosition {
  /** 1 起 */
  line: number;
  /** 1 起，按 UTF-16 代码单元计（与 CodeMirror / ProseMirror 的 offset 一致）。 */
  column: number;
}

export interface EditorStats extends EditorPosition {
  characters: number;
}

const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === "function" ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** 字数口径：去掉空白后的 Unicode 字符数，中英文都按「字」计数。 */
export function countCharacters(text: string): number {
  const content = text.replace(/\s/gu, "");
  if (!GRAPHEME_SEGMENTER) return Array.from(content).length;
  let count = 0;
  const segments = GRAPHEME_SEGMENTER.segment(content)[Symbol.iterator]();
  while (!segments.next().done) count += 1;
  return count;
}

/** 把纯文本 offset 转成 1 起行列；CRLF 与单 CR 都只算一次换行。 */
export function positionAt(text: string, offset: number): EditorPosition {
  const limit = Math.min(Math.max(Math.trunc(offset), 0), text.length);
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < limit; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    } else if (text[index] === "\r") {
      line += 1;
      if (text[index + 1] === "\n" && index + 1 < limit) index += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: limit - lineStart + 1 };
}

export function statsAt(text: string, offset: number): EditorStats {
  return { characters: countCharacters(text), ...positionAt(text, offset) };
}
