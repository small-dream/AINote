import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/i18n";
import { SectionBlock } from "./WikiSections";

/** Markdown 别名编辑：写入标准 aliases frontmatter。 */
export function WikiAliasesSection({ aliases, onAdd, onRemove }: { aliases: string[]; onAdd: (alias: string) => void; onRemove: (alias: string) => void }) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const add = () => {
    const alias = input.trim();
    if (!alias) return;
    onAdd(alias);
    setInput("");
  };
  return (
    <SectionBlock title={t("wiki.aliases")} empty={t("wiki.noAliases")}>
      <div className="flex flex-wrap gap-1.5">
        {aliases.map((alias) => (
          <span key={alias} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
            {alias}
            <button type="button" aria-label={`${t("wiki.removeAlias")} ${alias}`} onClick={() => onRemove(alias)} className="rounded-full text-text-tertiary hover:text-danger"><X size={10} /></button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }}
          placeholder={t("wiki.addAlias")}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <button type="button" onClick={add} disabled={!input.trim()} className="inline-flex items-center gap-1 rounded-md border border-accent/40 px-2 text-xs text-accent hover:bg-accent-soft disabled:opacity-50">
          <Plus size={12} /> {t("common.save")}
        </button>
      </div>
    </SectionBlock>
  );
}
