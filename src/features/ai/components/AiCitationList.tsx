import { ChevronDown, FileText } from "lucide-react";
import type { ContextSnippet } from "@/api/types";
import { useTranslation } from "@/i18n";
import { citedSnippets } from "../utils/citations";

interface Props {
  answer: string;
  citations: ContextSnippet[];
  onOpen: (citation: ContextSnippet) => void;
}

/** 回答下方引用区：已引用芯片 + 本次全部检索来源折叠区。 */
export function AiCitationList({ answer, citations, onOpen }: Props) {
  const { t } = useTranslation();
  if (citations.length === 0) return null;
  const cited = citedSnippets(answer, citations);
  return (
    <div className="mt-1 flex w-full flex-col gap-1.5">
      {cited.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-text-tertiary">{t("ai.citedSources")}</span>
          {cited.map((citation) => (
            <button key={citation.index} type="button" onClick={() => onOpen(citation)} className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] text-accent hover:border-accent" title={citation.path}>
              <FileText size={10} /><span className="shrink-0">[{citation.index}]</span><span className="truncate">{citation.heading ?? basename(citation.path)}</span>
            </button>
          ))}
        </div>
      ) : <p className="text-[11px] text-warning">{t("ai.citationsMissing")}</p>}
      <details className="rounded-md border border-border/70 bg-bg-secondary/50 px-2 py-1.5 text-xs text-text-secondary">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-text-tertiary">
          <ChevronDown size={12} /> {t("ai.allSources", { count: citations.length })}
        </summary>
        <ul className="mt-1.5 space-y-1.5">
          {citations.map((citation) => (
            <li key={citation.index}>
              <button type="button" onClick={() => onOpen(citation)} className="block w-full text-left hover:text-accent">
                <span className="mr-1 font-mono text-[10px] text-accent">[{citation.index}]</span>
                <span className="font-medium">{citation.path}</span>
                {citation.heading ? <span className="ml-1 text-text-tertiary"># {citation.heading}</span> : null}
                <span className="mt-0.5 block truncate text-[11px] text-text-tertiary">{citation.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function basename(path: string): string {
  return path.split("/").at(-1)?.replace(/\.(md|ainote)$/i, "") ?? path;
}
