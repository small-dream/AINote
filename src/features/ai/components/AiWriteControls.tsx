import type { ReactElement } from "react";
import type { UseAiWriteReturn } from "../hooks/useAiWriteTypes";
import { AiWriteMenu } from "./AiWriteMenu";
import { AiPreviewDialog } from "./AiPreviewDialog";
import { AiSuggestDialog } from "./AiSuggestDialog";
import { useUiStore } from "@/stores/ui.store";
import type { UseAiSuggestReturn } from "../hooks/useAiSuggestTypes";

interface AiWriteControlsProps {
  ai: UseAiWriteReturn;
  /** 是否显示「生成摘要」（仅 Markdown 支持写入 frontmatter） */
  canSummarize?: boolean;
  /** 是否显示「标题建议 / 大纲建议」（P1-AI-3，仅 Markdown） */
  canSuggest?: boolean;
  /** 文档级建议状态机（宿主用 useAiSuggest 创建，Markdown 编辑器传入） */
  suggest?: UseAiSuggestReturn;
}

/** 组合 AI 写作浮层（动作菜单 + 结果预览确认），宿主只需提供 useAiWrite 实例 */
export function AiWriteControls({ ai, canSummarize = false, canSuggest = false, suggest }: AiWriteControlsProps): ReactElement {
  return (
    <>
      <AiWriteMenu open={ai.menuOpen} hasSelection={ai.hasSelection} canSummarize={canSummarize} canSuggest={canSuggest} onPick={ai.run} {...(suggest ? { onTitleSuggest: suggest.startTitle, onOutlineSuggest: suggest.startOutline } : {})} onAsk={() => useUiStore.getState().openAskAi()} onClose={ai.closeMenu} />
      <AiPreviewDialog
        open={ai.preview !== null || ai.loading}
        text={ai.preview ?? ""}
        error={ai.error}
        loading={ai.loading}
        hasSelection={ai.hasSelection}
        onConfirm={ai.confirm}
        onRetry={ai.retry}
        onCancel={ai.cancel}
      />
      {suggest ? <AiSuggestDialog suggest={suggest} onRetry={retrySuggest(suggest)} /> : null}
    </>
  );
}

function retrySuggest(suggest: UseAiSuggestReturn): () => void {
  return () => {
    if (suggest.kind === "title") suggest.startTitle();
    else if (suggest.kind === "outline") suggest.startOutline();
  };
}
