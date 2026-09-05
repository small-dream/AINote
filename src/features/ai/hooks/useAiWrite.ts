import { useCallback, useRef, useState } from "react";
import { aiApi, messageOf } from "@/api";
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
  const [hasSelection, setHasSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selectionRef = useRef<AiSelection | null>(null);
  const lastActionRef = useRef<AiWriteAction | null>(null);
  const openMenu = useCallback(() => { const selection = getSelection(); selectionRef.current = selection; setHasSelection(selection.hasSelection); setMenuOpen(true); }, [getSelection]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const run = useCallback(async (action: AiWriteAction) => {
    const sel = selectionRef.current;
    if (!sel) return;
    lastActionRef.current = action;
    setMenuOpen(false); setLoading(true); setError(null); setPreview("");
    try {
      const source = action === AI_SUMMARIZE || AI_DOCUMENT_ACTIONS.includes(action)
        ? (sel.fullText ?? sel.text)
        : sel.text;
      const full = await aiApi.generateStream(
        actionSystem(action),
        buildWritePrompt(action, source, sel.contextTitle),
        (delta) => setPreview((prev) => (prev ?? "") + delta),
        useAiModelStore.getState().selectedModelId,
      );
      setPreview(full);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, []);
  const retry = useCallback(() => { const action = lastActionRef.current; if (action) void run(action); }, [run]);
  const confirm = useCallback(() => {
    if (preview === null) return;
    if (lastActionRef.current === AI_SUMMARIZE) onApplySummary?.(preview);
    else if (lastActionRef.current === "optimize" && selectionRef.current?.hasSelection !== true) onApplyFull?.(preview);
    else onApply(preview);
    setPreview(null);
  }, [preview, onApply, onApplyFull, onApplySummary]);
  const cancel = useCallback(() => setPreview(null), []);
  return { menuOpen, loading, preview, error, hasSelection, openMenu, closeMenu, run, retry, confirm, cancel };
}
