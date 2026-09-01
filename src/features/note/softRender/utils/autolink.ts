import type { RangeIndex } from "./ranges";

export interface AutolinkRange {
  from: number;
  to: number;
  href: string;
}

const URL_RE = /(https?:\/\/[^\s<>"{}\\^`[\]]+)/g;
const EMAIL_RE = /(?<![\w.-])([\w.-]+@[\w.-]+\.\w{2,})/g;

/** 从文本中提取可被渲染为链接的 URL / 邮箱范围。 */
export function findAutolinks(doc: string, protectedRanges: RangeIndex): AutolinkRange[] {
  const ranges: AutolinkRange[] = [];
  for (const match of doc.matchAll(URL_RE)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (protectedRanges.contains(from, to)) continue;
    ranges.push({ from, to, href: match[0] });
  }
  for (const match of doc.matchAll(EMAIL_RE)) {
    const from = match.index ?? 0;
    const to = from + match[0].length;
    if (protectedRanges.contains(from, to)) continue;
    ranges.push({ from, to, href: `mailto:${match[0]}` });
  }
  return ranges;
}
