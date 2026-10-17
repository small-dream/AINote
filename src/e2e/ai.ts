/** E2E mock：AI 配置与全库问答流（引用事件先于 delta）。 */
import type { AiChatStreamEvent, ContextSnippet } from "@/api/types";

type AiHandler = (args: Record<string, unknown>) => unknown;

const MODEL = { id: "e2e-model", providerId: "e2e-provider", modelId: "e2e-model", displayName: "E2E Model", enabled: true };

function citationsFor(query: string | null): ContextSnippet[] {
  if (!query) return [];
  return [{ index: 1, path: "plan.md", heading: "项目计划", line: 3, text: "这是计划正文，包含可验证的引用来源。" }];
}

function answerFor(query: string | null): string {
  return query ? "根据笔记内容 [1]，项目计划需要继续推进。" : "这是仅基于当前笔记的回答。";
}

export const aiCommandHandlers: Record<string, AiHandler> = {
  ai_get_config: () => ({
    enabled: true,
    providers: [{ id: "e2e-provider", provider: "openAiCompatible", displayName: "E2E", baseUrl: "https://e2e.invalid", enabled: true, hasKey: true }],
    models: [MODEL],
    defaultModelId: MODEL.id,
  }),
  ai_chat: (args) => {
    const query = args.repoQuery ? String(args.repoQuery) : null;
    return { text: answerFor(query), citations: citationsFor(query) };
  },
  ai_chat_stream: (args) => {
    const query = args.repoQuery ? String(args.repoQuery) : null;
    const citations = citationsFor(query);
    const text = answerFor(query);
    const channel = args.onEvent as { onmessage?: (event: AiChatStreamEvent) => void } | undefined;
    channel?.onmessage?.({ kind: "citations", citations });
    for (const delta of ["根据笔记内容 ", "[1]", "，项目计划需要继续推进。"]) {
      channel?.onmessage?.({ kind: "delta", delta });
    }
    return { text, citations };
  },
};
