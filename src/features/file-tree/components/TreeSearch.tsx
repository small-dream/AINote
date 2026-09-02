import { FilePenLine, Search, X } from "lucide-react";
import type { SearchResult } from "@/api/types";
import { noteKindOfPath } from "@/features/note/utils/noteKind";
import { useTranslation } from "@/i18n";

interface TreeSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

/** 目录工具栏内的搜索输入框（替换原「目录」标签）。 */
export function TreeSearchInput({ value, onChange }: TreeSearchInputProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-bg-primary px-2 py-1.5 text-text-tertiary transition-colors focus-within:border-accent focus-within:text-accent">
      <Search size={14} className="shrink-0" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("tree.searchPlaceholder")}
        aria-label={t("tree.searchPlaceholder")}
        className="tree-search-input min-w-0 flex-1 bg-transparent text-xs text-text-primary outline-none focus-visible:outline-none placeholder:text-text-tertiary"
      />
      {value && (
        <button
          type="button"
          aria-label={t("tree.clearSearch")}
          title={t("tree.clearSearch")}
          onClick={() => onChange("")}
          className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

interface TreeSearchResultsProps {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  onSelect: (path: string) => void;
}

/** 搜索进行时替换目录树展示的命中列表，点击打开笔记。 */
export function TreeSearchResults({ query, results, isSearching, error, onSelect }: TreeSearchResultsProps) {
  const { t } = useTranslation();
  if (error) {
    return <div className="px-3 py-6 text-center text-sm text-danger" role="alert">{t("tree.searchError", { message: error })}</div>;
  }
  if (results.length === 0) {
    const message = isSearching ? t("tree.searching") : t("tree.searchNoResults", { query });
    return <div className="px-3 py-6 text-center text-sm text-text-tertiary">{message}</div>;
  }
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label={t("palette.searchNotes")}>
      {results.map((result) => (
        <li key={result.path}>
          <SearchResultItem result={result} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  );
}

function SearchResultItem({ result, onSelect }: { result: SearchResult; onSelect: (path: string) => void }) {
  const isRichText = noteKindOfPath(result.path) === "richText";
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text-primary transition-colors hover:bg-bg-tertiary"
      onClick={() => onSelect(result.path)}
    >
      {isRichText ? (
        <FilePenLine size={15} strokeWidth={1.8} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      ) : (
        <span className="tree-file flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-text-tertiary text-[9px] font-semibold text-text-tertiary" aria-hidden="true">M</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{result.title}</span>
        <span className="block truncate text-xs text-text-tertiary">{result.path}</span>
      </span>
    </button>
  );
}
