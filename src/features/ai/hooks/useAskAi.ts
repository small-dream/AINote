import { useCallback, useState } from "react";
import { aiApi, messageOf, type AiChatMessage } from "@/api";
import { useAiModelStore } from "@/stores/aiModel.store";
import { buildChatSystem, type AskScope } from "../utils/prompts";

interface UseAskAiOptions {
  noteContent: string;
}

/** Ask AI 面板逻辑：对话历史、上下文范围、流式发送编排（本地 UI 态，不进入 Query） */
export function useAskAi({ noteContent }: UseAskAiOptions) {
  const [history, setHistory] = useState<AiChatMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [scope, setScope] = useState<AskScope>("current");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    const userMsg: AiChatMessage = { role: "user", content: question };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    setStreaming("");
    setError(null);
    try {
      const system = buildChatSystem(scope, noteContent);
      const full = await aiApi.chatStream(
        [{ role: "system", content: system }, ...nextHistory],
        scope === "repo" ? question : null,
        (delta) => setStreaming((prev) => prev + delta),
        useAiModelStore.getState().selectedModelId,
      );
      setStreaming("");
      setHistory((h) => [...h, { role: "assistant", content: full }]);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [input, loading, scope, noteContent, history]);

  const reset = useCallback(() => {
    setHistory([]);
    setStreaming("");
    setError(null);
  }, []);

  return { history, streaming, scope, input, loading, error, setInput, setScope, send, reset };
}
