import type { ContextSnippet } from "@/api/types";

/** 提取回答中实际出现的 [n] 编号（去重，仅保留来源范围内的编号）。 */
export function citedIndices(answer: string, citations: ContextSnippet[]): number[] {
  const valid = new Set(citations.map((item) => item.index));
  const found = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const index = Number(match[1]);
    if (valid.has(index)) found.add(index);
  }
  return [...found].sort((a, b) => a - b);
}

/** 过滤出回答真正引用到的来源；模型漏标时返回空数组。 */
export function citedSnippets(answer: string, citations: ContextSnippet[]): ContextSnippet[] {
  const indices = new Set(citedIndices(answer, citations));
  return citations.filter((item) => indices.has(item.index));
}
