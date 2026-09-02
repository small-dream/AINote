import { useCallback, useMemo, useState } from "react";
import { aiApi, messageOf } from "@/api";
import { buildSuggestPrompt, suggestSystem, type AiSuggestKind } from "../utils/prompts";
import { parseTitleSuggestions } from "../utils/titles";

interface UseAiSuggestOptions {
  /** 当前笔记全文（Markdown，作为标题/大纲建议的源） */
  noteText: string;
  /** 应用所选标题（宿主替换首行标题） */
  onApplyTitle: (title: string) => void;
  /** 把生成的大纲插入笔记（宿主追加文末） */
  onInsertOutline: (outline: string) => void;
}

/** 文档级 AI 建议：标题候选选择应用 / 大纲插入（P1-AI-3），复用流式接口 */
export function useAiSuggest({ noteText, onApplyTitle, onInsertOutline }: UseAiSuggestOptions) {
  const [kind, setKind] = useState<AiSuggestKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const titles = useMemo(() => (kind === "title" ? parseTitleSuggestions(text) : []), [kind, text]);
  const start = useCallback(
    (next: AiSuggestKind) => {
      setKind(next);
      setLoading(true);
      setText("");
      setError(null);
      aiApi.generateStream(suggestSystem(next), buildSuggestPrompt(next, noteText), (delta) => setText((prev) => prev + delta))
        .then((full) => setText(full))
        .catch((err: unknown) => setError(messageOf(err)))
        .finally(() => setLoading(false));
    },
    [noteText],
  );
  const close = useCallback(() => { setKind(null); setText(""); setError(null); }, []);
  const pickTitle = useCallback((title: string) => { onApplyTitle(title); close(); }, [onApplyTitle, close]);
  const insertOutline = useCallback(() => { onInsertOutline(text); close(); }, [text, onInsertOutline, close]);
  return { kind, loading, text, error, titles, startTitle: () => start("title"), startOutline: () => start("outline"), pickTitle, insertOutline, close };
}
