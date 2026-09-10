import { useCallback, useMemo, useRef, useState } from "react";
import { aiApi, messageOf } from "@/api";
import { useAiModelStore } from "@/stores/aiModel.store";
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
  /** 请求序号：关闭或重新生成时自增，旧请求的增量与结果据此丢弃。 */
  const requestRef = useRef(0);
  const start = useCallback(
    (next: AiSuggestKind) => {
      const requestId = ++requestRef.current;
      setKind(next);
      setLoading(true);
      setText("");
      setError(null);
      aiApi.generateStream(
        suggestSystem(next),
        buildSuggestPrompt(next, noteText),
        (delta) => { if (requestRef.current === requestId) setText((prev) => prev + delta); },
        useAiModelStore.getState().selectedModelId,
      )
        .then((full) => { if (requestRef.current === requestId) setText(full); })
        .catch((err: unknown) => { if (requestRef.current === requestId) setError(messageOf(err)); })
        .finally(() => { if (requestRef.current === requestId) setLoading(false); });
    },
    [noteText],
  );
  /** 关闭建议面板：在途结果失效，避免关闭后文本被回填。 */
  const close = useCallback(() => { requestRef.current += 1; setKind(null); setText(""); setError(null); setLoading(false); }, []);
  const pickTitle = useCallback((title: string) => { onApplyTitle(title); close(); }, [onApplyTitle, close]);
  const insertOutline = useCallback(() => { onInsertOutline(text); close(); }, [text, onInsertOutline, close]);
  return { kind, loading, text, error, titles, startTitle: () => start("title"), startOutline: () => start("outline"), pickTitle, insertOutline, close };
}
