import { useEffect, useState } from "react";
import { useSearchQuery } from "@/queries/search.queries";
import { useCommandPaletteStore } from "@/stores/command-palette.store";
import type { SearchResult } from "@/api/types";

const DEBOUNCE_MS = 150;

/** 命令面板搜索输入：防抖后触发全文搜索；面板关闭时立即清空搜索词 */
export function usePaletteSearch(open: boolean, repoPath: string | null) {
  const query = useCommandPaletteStore((state) => state.query);
  const [activeQuery, setActiveQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setActiveQuery(open ? query : ""),
      open ? DEBOUNCE_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [query, open]);

  const { data: results, isFetching } = useSearchQuery(repoPath, activeQuery);

  return { results: results ?? [], isSearching: isFetching };
}

export type { SearchResult };
