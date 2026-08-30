/** 与 Rust 侧 domain/error.rs 的 AppErrorDto 保持结构一致 */
export type ErrorKind = "NotFound" | "Conflict" | "Auth" | "Io" | "Unknown";

export interface AppError {
  code: string;
  kind: ErrorKind;
  message: string;
  retriable: boolean;
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "kind" in value &&
    "message" in value
  );
}
