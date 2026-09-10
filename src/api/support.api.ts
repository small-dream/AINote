import { call } from "./client";
import type { DiagnosticsExportDto } from "./types";

export type FrontendLogLevel = "error" | "warn" | "info";

/** 前端日志上报：经 Rust 写入本地日志文件（写入前由日志层统一脱敏）。 */
export const supportApi = {
  log: (level: FrontendLogLevel, message: string, context?: string) =>
    call("log_frontend", { level, message, context }),
  /** 导出诊断包；用户取消保存时返回 null */
  exportDiagnostics: () => call<DiagnosticsExportDto | null>("export_diagnostics"),
};
