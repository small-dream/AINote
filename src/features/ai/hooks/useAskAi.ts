import { useCallback, useState } from "react";
import { aiApi, messageOf, type AiChatMessage, type ContextSnippet } from "@/api";
import { useAiModelStore } from "@/stores/aiModel.store";
import { buildChatSystem, type AskScope } from "../utils/prompts";

interface UseAskAiOptions {
  noteContent: string;
}

export interface AskAiMessage extends AiChatMessage {
  citations?: ContextSnippet[];
}

/** Ask AI 面板逻辑：本地历史按回答保存引用，发给 Rust 时仍只传 role/content。 */
export function useAskAi({ noteContent }: UseAskAiOptions) {
  const [history, setHistory] = useState<AskAiMessage[]>([]);
  const [streaming, setStreaming] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<ContextSnippet[]>([]);
  const [scope, setScope] = useState<AskScope>("current");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    const userMsg: AskAiMessage = { role: "user", content: question };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);
    setStreaming("");
    setStreamingCitations([]);
    setError(null);
    try {
      const system = buildChatSystem(scope, noteContent);
      const messages = [{ role: "system", content: system }, ...nextHistory].map(({ role, content }) => ({ role, content }));
      const reply = await aiApi.chatStream(
        messages,
        scope === "repo" ? question : null,
        (event) => {
          if (event.kind === "citations") setStreamingCitations(event.citations);
          else setStreaming((prev) => prev + event.delta);
        },
        useAiModelStore.getState().selectedModelId,
      );
      setStreaming("");
      setStreamingCitations(reply.citations);
      setHistory((current) => [...current, { role: "assistant", content: reply.text, citations: reply.citations }]);
    } catch (err) {
      setStreaming("");
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [input, loading, scope, noteContent, history]);

  const reset = useCallback(() => {
    setHistory([]);
    setStreaming("");
    setStreamingCitations([]);
    setError(null);
  }, []);

  return { history, streaming, streamingCitations, scope, input, loading, error, setInput, setScope, send, reset };
}
