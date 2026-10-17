import { useMemo, useState } from "react";
import type { SearchResult } from "@/api/types";
import {
  buildSearchFacets,
  filterSearchResults,
  type SearchFilters,
  type SearchKindFilter,
} from "../utils/filters";

/** 搜索结果筛选：目录选项按当前结果动态生成，失效目录自动回到「全部目录」。 */
export function useSearchResultFilters(results: readonly SearchResult[]) {
  const [filters, setFilters] = useState<SearchFilters>({ kind: "all", directory: "" });
  const facets = useMemo(() => buildSearchFacets(results), [results]);
  // 目录选项来自当前结果：结果变化导致原目录失效时，直接派生为「全部目录」，无需 effect 回写状态。
  const effectiveFilters = useMemo<SearchFilters>(() => (
    filters.directory && !facets.directories.includes(filters.directory)
      ? { ...filters, directory: "" }
      : filters
  ), [facets.directories, filters]);
  const filteredResults = useMemo(() => filterSearchResults(results, effectiveFilters), [results, effectiveFilters]);

  const setKind = (kind: SearchKindFilter) => setFilters((current) => ({ ...current, kind }));
  const setDirectory = (directory: string) => setFilters((current) => ({ ...current, directory }));

  return { filters: effectiveFilters, facets, results: filteredResults, setKind, setDirectory };
}
