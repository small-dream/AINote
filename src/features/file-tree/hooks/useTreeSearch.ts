import { useEffect, useState } from "react";
import type { SearchResult } from "@/api/types";
import { useSearchQuery } from "@/queries/search.queries";
import { messageOf } from "@/api";

const DEBOUNCE_MS = 150;

/** 侧边栏目录搜索：输入防抖后触发全文搜索，清空时立即复位（复用 search_notes）。 */
export function useTreeSearch(repoPath: string | null, query: string) {
  const [activeQuery, setActiveQuery] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(
      () => setActiveQuery(trimmed),
      trimmed ? DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching, error } = useSearchQuery(repoPath, activeQuery);

  return {
    results: results ?? [],
    /** 输入中（防抖未到位）或正在请求都视为搜索中。 */
    isSearching: activeQuery !== query.trim() || isFetching,
    error: error ? messageOf(error) : null,
  };
}

export type { SearchResult };
