import { Button } from "@/components/atoms/Button";
import { Modal } from "@/components/molecules/Modal";
import { Sparkles, MessagesSquare, FileText, Heading1, FolderTree, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/i18n";
import { AiModelSelect } from "./AiModelSelect";
import { AI_WRITE_ACTIONS, AI_SUMMARIZE, type AiWriteAction } from "../utils/prompts";
import { useUiStore } from "@/stores/ui.store";

const ACTION_LABELS: Record<AiWriteAction, "ai.polish" | "ai.translate" | "ai.shorten" | "ai.expand" | "ai.continue" | "ai.summarize" | "ai.compose" | "ai.review" | "ai.optimize"> = {
  polish: "ai.polish",
  translate: "ai.translate",
  shorten: "ai.shorten",
  expand: "ai.expand",
  continue: "ai.continue",
  summarize: "ai.summarize",
  compose: "ai.compose",
  review: "ai.review",
  optimize: "ai.optimize",
};

type DocIconKey = "write" | "summarize" | "ask" | "title" | "outline";
type ActionLabelKey = (typeof ACTION_LABELS)[keyof typeof ACTION_LABELS] | "ai.ask" | "ai.suggestTitle" | "ai.suggestOutline";

const ICONS: Record<DocIconKey, LucideIcon> = {
  write: Sparkles,
  summarize: FileText,
  ask: MessagesSquare,
  title: Heading1,
  outline: FolderTree,
};

interface AiWriteMenuProps {
  open: boolean;
  hasSelection: boolean;
  /** 是否显示「生成摘要」（仅 Markdown 支持写入 frontmatter） */
  canSummarize?: boolean;
  /** 是否显示「标题建议 / 大纲建议」（P1-AI-3，仅 Markdown） */
  canSuggest?: boolean;
  onPick: (action: AiWriteAction) => void;
  onTitleSuggest?: () => void;
  onOutlineSuggest?: () => void;
  onAsk: () => void;
  onClose: () => void;
}

/** AI 写作动作选择：改写/续写 + 文档级建议（摘要/标题/大纲）+ 问答跳转 */
export function AiWriteMenu({ open, hasSelection, canSummarize = false, canSuggest = false, onPick, onTitleSuggest, onOutlineSuggest, onAsk, onClose }: AiWriteMenuProps) {
  const { t } = useTranslation();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const actions = hasSelection ? AI_WRITE_ACTIONS : (["continue"] as const);
  return (
    <Modal open={open} title={t("ai.actionTitle")} onClose={onClose} className="note-theme-surface ai-theme-modal" noteTheme={noteTheme}>
      <div className="flex flex-col gap-2">
        <AiModelSelect className="w-full" />
        {actions.map((action) => (
          <ActionButton key={action} labelKey={ACTION_LABELS[action]} icon="write" onClick={() => onPick(action)} />
        ))}
        <DocActionButtons
          canSummarize={canSummarize}
          canSuggest={canSuggest}
          onCompose={() => onPick("compose")}
          onReview={() => onPick("review")}
          onOptimize={() => onPick("optimize")}
          onSummarize={() => onPick(AI_SUMMARIZE)}
          onTitleSuggest={onTitleSuggest}
          onOutlineSuggest={onOutlineSuggest}
        />
        <div className="my-1 border-t border-border" />
        <ActionButton labelKey="ai.ask" icon="ask" onClick={onAsk} />
      </div>
    </Modal>
  );
}

function DocActionButtons({ canSummarize, canSuggest, onCompose, onReview, onOptimize, onSummarize, onTitleSuggest, onOutlineSuggest }: {
  canSummarize: boolean;
  canSuggest: boolean;
  onCompose: () => void;
  onReview: () => void;
  onOptimize: () => void;
  onSummarize: () => void;
  onTitleSuggest?: (() => void) | undefined;
  onOutlineSuggest?: (() => void) | undefined;
}) {
  return (
    <>
      <ActionButton labelKey="ai.compose" icon="write" onClick={onCompose} />
      <ActionButton labelKey="ai.review" icon="summarize" onClick={onReview} />
      <ActionButton labelKey="ai.optimize" icon="outline" onClick={onOptimize} />
      {canSummarize ? <ActionButton labelKey="ai.summarize" icon="summarize" onClick={onSummarize} /> : null}
      {canSuggest && onTitleSuggest ? <ActionButton labelKey="ai.suggestTitle" icon="title" onClick={onTitleSuggest} /> : null}
      {canSuggest && onOutlineSuggest ? <ActionButton labelKey="ai.suggestOutline" icon="outline" onClick={onOutlineSuggest} /> : null}
    </>
  );
}

function ActionButton({ labelKey, icon, onClick }: { labelKey: ActionLabelKey; icon: DocIconKey; onClick: () => void }) {
  const { t } = useTranslation();
  const Icon = ICONS[icon];
  return (
    <Button variant="ghost" className="flex w-full items-center justify-start gap-2 px-3 py-2 text-left" onClick={onClick}>
      <Icon size={15} />
      {t(labelKey)}
    </Button>
  );
}
