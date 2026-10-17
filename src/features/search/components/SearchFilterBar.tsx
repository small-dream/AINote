import { useTranslation } from "@/i18n";
import type { SearchFacets, SearchFilters, SearchKindFilter } from "../utils/filters";
import { highlightSegments } from "../utils/filters";

interface SearchFilterBarProps {
  filters: SearchFilters;
  facets: SearchFacets;
  total: number;
  shown: number;
  onKindChange: (kind: SearchKindFilter) => void;
  onDirectoryChange: (directory: string) => void;
}

/** 目录与命令面板共用的搜索筛选条：类型、目录范围与结果计数。 */
export function SearchFilterBar({ filters, facets, total, shown, onKindChange, onDirectoryChange }: SearchFilterBarProps) {
  const { t } = useTranslation();
  const selectClass = "h-7 min-w-0 rounded-md border border-border bg-bg-primary px-1.5 text-xs text-text-secondary outline-none focus:border-accent";
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1.5" data-testid="search-filter-bar">
      <select aria-label={t("search.filterKind")} value={filters.kind} onChange={(event) => onKindChange(event.target.value as SearchKindFilter)} className={selectClass}>
        <option value="all">{t("search.filterAllKinds")}</option>
        <option value="markdown">{t("search.filterMarkdown")}</option>
        <option value="richText">{t("search.filterRichText")}</option>
      </select>
      <select aria-label={t("search.filterDirectory")} value={filters.directory} onChange={(event) => onDirectoryChange(event.target.value)} className={`${selectClass} min-w-24 flex-1`}>
        <option value="">{t("search.filterAllDirectories")}</option>
        {facets.directories.map((directory) => <option key={directory} value={directory}>{directory}</option>)}
      </select>
      <span className="ml-auto shrink-0 text-[11px] text-text-tertiary" aria-live="polite">
        {shown === total ? t("search.resultCount", { count: total }) : t("search.filteredCount", { shown, total })}
      </span>
    </div>
  );
}

/** 安全高亮：按片段渲染 <mark>，不引入 dangerouslySetInnerHTML。 */
export function HighlightedText({ text, query }: { text: string; query: string }) {
  return <>{highlightSegments(text, query).map((segment, index) => segment.match
    ? <mark key={index} className="rounded-sm bg-accent/25 px-0.5 text-inherit">{segment.text}</mark>
    : <span key={index}>{segment.text}</span>)}</>;
}
