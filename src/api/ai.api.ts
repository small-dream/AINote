import { Channel } from "@tauri-apps/api/core";
import { call } from "./client";
import type { AiChatMessage, AiProvider, AiReply, AiSettings, AiSettingsDto, AiStreamChunk } from "./types";

/** AI 能力（P0-AI-1 ~ P0-AI-4 / P1-AI-1）。repoPath 由 Rust 侧 config 读取。 */
export const aiApi = {
  /** 读取 AI 配置（含 hasKey，不含明文 Key） */
  getConfig: () => call<AiSettingsDto>("ai_get_config"),
  /** 保存设置；apiKey 传空字符串清除目标 Provider Key，null 保留所有已有 Key */
  saveConfig: (settings: AiSettings, apiKeys: { providerId: string; key: string }[]) =>
    call<null>("ai_save_config", { settings, apiKeys: apiKeys.length > 0 ? apiKeys : null }),
  /** 拉取 OpenAI 兼容模型目录（只读，不产生补全费用） */
  fetchModels: (providerId: string, baseUrl: string, provider: AiProvider) =>
    call<string[]>("ai_fetch_models", { providerId, baseUrl, provider }),
  /** 编辑器写作动作：system + prompt 单轮生成 */
  generate: (system: string, prompt: string, modelId?: string | null) =>
    call<AiReply>("ai_generate", { system, prompt, modelId: modelId ?? null }),
  /** 编辑器写作动作（流式）：每收到增量回调 onChunk，resolve 时输出完整文本 */
  generateStream: (system: string, prompt: string, onChunk: (delta: string) => void, modelId?: string | null) =>
    streamRequest("ai_generate_stream", { system, prompt, modelId: modelId ?? null }, onChunk),
  /** 问答；repoQuery 非空时由 Rust 侧检索全库段落并入上下文 */
  chat: (messages: AiChatMessage[], repoQuery: string | null, modelId?: string | null) =>
    call<AiReply>("ai_chat", { messages, repoQuery, modelId: modelId ?? null }),
  /** 问答（流式） */
  chatStream: (
    messages: AiChatMessage[],
    repoQuery: string | null,
    onChunk: (delta: string) => void,
    modelId?: string | null,
  ) => streamRequest("ai_chat_stream", { messages, repoQuery, modelId: modelId ?? null }, onChunk),
};

/** 流式请求封装：Tauri Channel 逐块回调；Command 成功后 resolve 拼接的完整文本 */
function streamRequest(command: string, args: Record<string, unknown>, onChunk: (delta: string) => void): Promise<string> {
  const channel = new Channel<AiStreamChunk>();
  let full = "";
  channel.onmessage = (chunk) => {
    full += chunk.delta;
    onChunk(chunk.delta);
  };
  return call<null>(command, { ...args, onEvent: channel }).then(() => full);
}
