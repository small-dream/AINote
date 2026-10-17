import { X } from "lucide-react";
import { Tooltip } from "@/components/atoms/Tooltip";
import { useTranslation } from "@/i18n";
import { useBackHandler } from "@/platform/back-navigation";
import type { NoteNavigationTarget } from "@/stores/session.store";
import { appendTagToContent, removeTagFromContent } from "../utils/tagContent";
import { useWikiPanel } from "../hooks/useWikiPanel";
import { WikiAliasesSection } from "./WikiAliasesSection";
import { BacklinksSection, OutgoingSection, TagsSection } from "./WikiSections";
import { UnlinkedMentionsSection } from "./UnlinkedMentionsSection";

interface WikiPanelProps {
  repoPath: string | null;
  path: string | null;
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string, target?: NoteNavigationTarget) => void;
  draft: string;
  kind: "markdown" | "richText";
  onChange: (value: string) => void;
}

/** 双链与标签面板：标签 / 别名 / 出链 / 反链 / 未链接提及。 */
export function WikiPanel({ repoPath, path, open, onClose, onOpenNote, draft, kind, onChange }: WikiPanelProps) {
  const { t } = useTranslation();
  const panel = useWikiPanel(repoPath, path, draft, kind, open, onChange, onOpenNote);
  useBackHandler(open, onClose);
  if (!open || !path) return null;

  return (
    <div data-mobile-overlay="wiki" className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("wiki.title")} className="mx-auto mt-16 flex h-[70vh] w-[min(680px,90vw)] flex-col overflow-hidden rounded-xl bg-bg-primary shadow-2xl">
        <PanelHeader path={path} onClose={onClose} />
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <TagsSection tags={panel.tags} suggestions={panel.suggestions} onAdd={(tag) => onChange(appendTagToContent(draft, tag, kind))} onRemove={(tag) => onChange(removeTagFromContent(draft, tag, kind))} />
          {kind === "markdown" ? <WikiAliasesSection aliases={panel.aliases} onAdd={panel.addAlias} onRemove={panel.removeAlias} /> : null}
          <OutgoingSection links={panel.outgoing} creating={panel.creating} onOpen={panel.handleOpen} onCreate={panel.handleCreate} />
          <BacklinksSection backlinks={panel.backlinks} nameIndex={panel.nameIndex} targetPath={path} onOpen={panel.handleOpen} />
          <UnlinkedMentionsSection
            mentions={panel.mentions}
            loading={panel.mentionsLoading}
            converting={panel.converting}
            onConvert={panel.handleConvert}
            onOpenSource={(sourcePath, line) => onOpenNote(sourcePath, { path: sourcePath, line })}
          />
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ path, onClose }: { path: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t("wiki.title")}</h2>
        <p className="truncate text-[11px] text-text-tertiary">{path}</p>
      </div>
      <Tooltip content={t("common.close")}>
        <button type="button" aria-label={t("common.cancel")} onClick={onClose} className="shrink-0 rounded p-1 text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"><X size={16} /></button>
      </Tooltip>
    </div>
  );
}
