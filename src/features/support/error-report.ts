import { supportApi } from "@/api";

const MAX_REPORT_CHARS = 2_000;

interface ErrorDetail {
  name: string;
  message: string;
  stack: string;
}

/** 生成可复制的诊断文本（凭证与用户目录由 Rust 日志层二次脱敏）。 */
export function formatErrorReport(error: unknown, source: string): string {
  const detail = normalizeError(error);
  const lines = [
    `source: ${source}`,
    `time: ${new Date().toISOString()}`,
    `userAgent: ${typeof navigator === "undefined" ? "unknown" : navigator.userAgent}`,
    `name: ${detail.name}`,
    `message: ${detail.message}`,
  ];
  if (detail.stack) lines.push(`stack:\n${detail.stack}`);
  return lines.join("\n");
}

/** 上报到 Rust 日志；失败静默，绝不影响主流程。 */
export function reportFrontendError(error: unknown, source: string, context = ""): void {
  const report = truncate(formatErrorReport(error, source));
  void supportApi.log("error", report, context || undefined).catch(() => undefined);
}

function normalizeError(error: unknown): ErrorDetail {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack ?? "" };
  }
  return { name: "UnknownError", message: stringify(error), stack: "" };
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(value: string): string {
  return value.length > MAX_REPORT_CHARS ? value.slice(0, MAX_REPORT_CHARS) : value;
}
