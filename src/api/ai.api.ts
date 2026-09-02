import { Channel } from "@tauri-apps/api/core";
import { call } from "./client";
import type { AiChatMessage, AiConfigDto, AiReply, AiStreamChunk } from "./types";

/** AI 能力（P0-AI-1 ~ P0-AI-4 / P1-AI-1）。repoPath 由 Rust 侧 config 读取。 */
export const aiApi = {
  /** 读取 AI 配置（含 hasKey，不含明文 Key） */
  getConfig: () => call<AiConfigDto>("ai_get_config"),
  /** 保存配置；apiKey 传空字符串清除 Key，null 保留已有 Key */
  saveConfig: (cfg: Omit<AiConfigDto, "hasKey">, apiKey: string | null) =>
    call<null>("ai_save_config", { cfg, apiKey }),
  /** 编辑器写作动作：system + prompt 单轮生成 */
  generate: (system: string, prompt: string) =>
    call<AiReply>("ai_generate", { system, prompt }),
  /** 编辑器写作动作（流式）：每收到增量回调 onChunk，resolve 时输出完整文本 */
  generateStream: (system: string, prompt: string, onChunk: (delta: string) => void) =>
    streamRequest("ai_generate_stream", { system, prompt }, onChunk),
  /** 问答；repoQuery 非空时由 Rust 侧检索全库段落并入上下文 */
  chat: (messages: AiChatMessage[], repoQuery: string | null) =>
    call<AiReply>("ai_chat", { messages, repoQuery }),
  /** 问答（流式） */
  chatStream: (messages: AiChatMessage[], repoQuery: string | null, onChunk: (delta: string) => void) =>
    streamRequest("ai_chat_stream", { messages, repoQuery }, onChunk),
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
