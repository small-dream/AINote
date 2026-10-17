import type { SearchResult } from "@/api/types";
import { noteKindOfPath } from "@/features/note/utils/noteKind";

export type SearchKindFilter = "all" | "markdown" | "richText";

export interface SearchFilters {
  kind: SearchKindFilter;
  /** 空字符串表示全部目录；非空时包含该目录及其子目录。 */
  directory: string;
}

export interface SearchFacets {
  directories: string[];
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = { kind: "all", directory: "" };

export function filterSearchResults(results: readonly SearchResult[], filters: SearchFilters): SearchResult[] {
  return results.filter((result) => {
    if (filters.kind !== "all" && noteKindOfPath(result.path) !== filters.kind) return false;
    if (!filters.directory) return true;
    return result.path === filters.directory || result.path.startsWith(`${filters.directory}/`);
  });
}

/** 从当前结果动态生成目录选项；包含所有祖先目录，选择父目录时覆盖子树。 */
export function buildSearchFacets(results: readonly SearchResult[]): SearchFacets {
  const directories = new Set<string>();
  for (const result of results) {
    const parts = result.path.split("/");
    parts.pop();
    for (let index = 1; index <= parts.length; index += 1) {
      const directory = parts.slice(0, index).join("/");
      if (directory) directories.add(directory);
    }
  }
  return { directories: Array.from(directories).sort((a, b) => a.localeCompare(b)) };
}

/** 按不区分大小写的完整查询词切分文本，返回可直接渲染的片段（避免 innerHTML）。 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const needle = query.trim();
  if (!needle || !text) return [{ text, match: false }];
  const haystack = text.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let match = haystack.indexOf(lowerNeedle);
  while (match !== -1) {
    if (match > cursor) segments.push({ text: text.slice(cursor, match), match: false });
    segments.push({ text: text.slice(match, match + needle.length), match: true });
    cursor = match + needle.length;
    match = haystack.indexOf(lowerNeedle, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments.length > 0 ? segments : [{ text, match: false }];
}
