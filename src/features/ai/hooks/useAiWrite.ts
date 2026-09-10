import { useCallback, useRef, useState } from "react";
import { aiApi, messageOf, recordMetric } from "@/api";
import { useAiModelStore } from "@/stores/aiModel.store";
import { actionSystem, buildWritePrompt, AI_SUMMARIZE, AI_DOCUMENT_ACTIONS, type AiWriteAction } from "../utils/prompts";

export interface AiSelection {
  text: string;
  hasSelection: boolean;
  contextTitle?: string | undefined;
  fullText?: string | undefined;
}

interface UseAiWriteOptions {
  getSelection: () => AiSelection;
  onApply: (text: string) => void;
  onApplyFull?: (text: string) => void;
  onApplySummary?: (summary: string) => void;
}

/** 编辑器 AI 写作编排：菜单 → 流式生成 → 预览确认 → 落笔/摘要入 frontmatter */
export function useAiWrite({ getSelection, onApply, onApplyFull, onApplySummary }: UseAiWriteOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyDocument, setApplyDocument] = useState(false);
  const selectionRef = useRef<AiSelection | null>(null);
  const lastActionRef = useRef<AiWriteAction | null>(null);
  /** 请求序号：取消或再次发起时自增，旧请求的增量与结果据此丢弃。 */
  const requestRef = useRef(0);
  const openMenu = useCallback(() => { const selection = getSelection(); selectionRef.current = selection; setHasSelection(selection.hasSelection); setMenuOpen(true); }, [getSelection]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const run = useCallback(async (action: AiWriteAction) => {
    const sel = selectionRef.current;
    if (!sel) return;
    lastActionRef.current = action;
    const requestId = ++requestRef.current;
    const documentAction = action === "review" || (action === "optimize" && selectionRef.current?.hasSelection !== true);
    setMenuOpen(false); setOpen(true); setLoading(true); setError(null); setPreview(""); setApplyDocument(documentAction);
    try {
      const source = action === AI_SUMMARIZE || AI_DOCUMENT_ACTIONS.includes(action)
        ? (sel.fullText ?? sel.text)
        : sel.text;
      const full = await aiApi.generateStream(
        actionSystem(action),
        buildWritePrompt(action, source, sel.contextTitle),
        (delta) => { if (requestRef.current === requestId) setPreview((prev) => (prev ?? "") + delta); },
        useAiModelStore.getState().selectedModelId,
      );
      if (requestRef.current !== requestId) return;
      setPreview(full);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(messageOf(err));
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);
  const retry = useCallback(() => { const action = lastActionRef.current; if (action) void run(action); }, [run]);
  const confirm = useCallback(() => {
    if (preview === null) return;
    if (lastActionRef.current === AI_SUMMARIZE) onApplySummary?.(preview);
    else if (applyDocument) onApplyFull?.(preview);
    else onApply(preview);
    recordMetric("ai_action_confirmed");
    setOpen(false);
    setPreview(null);
  }, [preview, applyDocument, onApply, onApplyFull, onApplySummary]);
  /**
   * 取消：关闭预览并让在途流式结果失效。
   * 网络请求本身已发出、无法中止（Rust 侧阻塞读取 SSE），但后续增量与最终结果一律丢弃。
   */
  const cancel = useCallback(() => {
    requestRef.current += 1;
    setOpen(false);
    setLoading(false);
    setPreview(null);
    setError(null);
  }, []);
  return { menuOpen, open, loading, preview, error, hasSelection, applyDocument, openMenu, closeMenu, run, retry, confirm, cancel };
}
