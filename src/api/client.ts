import { invoke } from "@tauri-apps/api/core";
import { isAppError, type AppError } from "./error";

/**
 * 前端唯一跨边界点：所有 Tauri IPC 必须经过此封装。
 * 负责把 Rust 侧返回的 AppError 结构化抛出，禁止组件直接 invoke()。
 */
export function call(command: string, args?: Record<string, unknown>): Promise<void>;
export function call<T>(command: string, args?: Record<string, unknown>): Promise<T>;
export async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    if (isAppError(err)) throw err;
    throw toUnknownError(err);
  }
}

function toUnknownError(err: unknown): AppError {
  return {
    code: "UNKNOWN_9001",
    kind: "Unknown",
    message: err instanceof Error ? err.message : String(err),
    retriable: false,
  };
}
