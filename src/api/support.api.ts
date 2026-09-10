import { call } from "./client";

export type FrontendLogLevel = "error" | "warn" | "info";

/** 前端日志上报：经 Rust 写入本地日志文件（写入前由日志层统一脱敏）。 */
export const supportApi = {
  log: (level: FrontendLogLevel, message: string, context?: string) =>
    call("log_frontend", { level, message, context }),
};
