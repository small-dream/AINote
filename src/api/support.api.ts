import { call } from "./client";
import type { DiagnosticsExportDto, SupportInfoDto } from "./types";

export type FrontendLogLevel = "error" | "warn" | "info";

/** 前端日志上报：经 Rust 写入本地日志文件（写入前由日志层统一脱敏）。 */
export const supportApi = {
  log: (level: FrontendLogLevel, message: string, context?: string) =>
    call("log_frontend", { level, message, context }),
  /** 导出诊断包；用户取消保存时返回 null */
  exportDiagnostics: () => call<DiagnosticsExportDto | null>("export_diagnostics"),
  /** 读取日志目录、开关与占用 */
  info: () => call<SupportInfoDto>("support_info"),
  /** 切换本地日志开关（立即生效并持久化） */
  setLoggingEnabled: (enabled: boolean) => call("set_logging_enabled", { enabled }),
  /** 清理本地日志，返回释放字节数 */
  clearLogs: () => call<number>("clear_logs"),
};
