import { CornerDownRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/i18n";
import type { UnlinkedMention, UnlinkedMentionRef } from "@/api/types";
import { SectionBlock } from "./WikiSections";

interface Props {
  mentions: UnlinkedMention[];
  loading: boolean;
  converting: boolean;
  onConvert: (refs: UnlinkedMentionRef[]) => Promise<void>;
  onOpenSource: (path: string, line: number) => void;
}

/** 未链接提及：逐条转换，批量转换需二次确认。 */
export function UnlinkedMentionsSection({ mentions, loading, converting, onConvert, onOpenSource }: Props) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const refs = mentions.map(({ sourcePath, term, occurrence }) => ({ sourcePath, term, occurrence }));
  const convertAll = async () => {
    await onConvert(refs);
    setConfirming(false);
  };
  if (loading) return <SectionBlock title={t("wiki.unlinkedMentions")} empty={t("common.loading")} />;
  if (mentions.length === 0) return <SectionBlock title={t("wiki.unlinkedMentions")} empty={t("wiki.noUnlinkedMentions")} />;
  return (
    <SectionBlock title={`${t("wiki.unlinkedMentions")} (${mentions.length})`}>
      <div className="mb-2 flex justify-end">
        {confirming ? (
          <span className="flex items-center gap-1.5">
            <button type="button" disabled={converting} onClick={() => void convertAll()} className="rounded-md bg-accent px-2 py-1 text-xs text-white disabled:opacity-50">{t("wiki.confirmConvertAll")}</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-2 py-1 text-xs">{t("common.cancel")}</button>
          </span>
        ) : (
          <button type="button" disabled={converting} onClick={() => setConfirming(true)} className="rounded-md border border-accent/40 px-2 py-1 text-xs text-accent hover:bg-accent-soft disabled:opacity-50">{t("wiki.convertAll")}</button>
        )}
      </div>
      <ul className="space-y-2">
        {mentions.map((mention) => (
          <li key={`${mention.sourcePath}:${mention.term}:${mention.occurrence}`} className="rounded-lg border border-border/70 bg-bg-secondary/60 p-2">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onOpenSource(mention.sourcePath, mention.line)} className="min-w-0 text-left text-xs font-medium text-accent hover:underline">{mention.sourceTitle}</button>
              <button type="button" disabled={converting} onClick={() => void onConvert([{ sourcePath: mention.sourcePath, term: mention.term, occurrence: mention.occurrence }])} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 px-2 py-0.5 text-[11px] text-accent hover:bg-accent-soft disabled:opacity-50">
                <CornerDownRight size={11} /> {t("wiki.convert")}
              </button>
            </div>
            <p className="mt-1 truncate text-xs text-text-secondary">
              <span className="mr-1 rounded bg-bg-tertiary px-1 font-mono text-[10px] text-text-tertiary">L{mention.line}</span>
              {mention.snippet}
            </p>
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}
