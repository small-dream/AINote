/** 与 Rust 侧 domain/error.rs 的 AppErrorDto 保持结构一致（serde camelCase 序列化） */
export type ErrorKind =
  | "notFound"
  | "conflict"
  | "auth"
  | "network"
  | "permission"
  | "io"
  | "unknown";

export interface AppError {
  code: string;
  kind: ErrorKind;
  message: string;
  retriable: boolean;
  /** 同步类错误才有：后端定位到的失败阶段（E4-T4） */
  stage?: SyncStage;
  /** 同步类错误才有：可定位到的失败文件（如拉取冲突的文件） */
  files?: string[];
  /** 同步类错误才有：后端给出的建议码，优先于按错误码推断 */
  hint?: SyncHint;
}

/** 后端定位到的同步阶段（与 Rust domain/sync.rs 的 SyncStage 一致） */
export type SyncStage = "commit" | "pull" | "push";

/** 后端给出的可操作建议码 */
export type SyncHint = "retry" | "relogin" | "checkPermission" | "resolveConflicts";

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "kind" in value &&
    "message" in value
  );
}

/** 从任意错误中提取用户可读消息（AppError 优先） */
export function messageOf(err: unknown): string {
  if (isAppError(err)) return err.message;
  return err instanceof Error ? err.message : String(err);
}

/** 同步类错误对应的可操作建议 */
export type ErrorAction = "retry" | "relogin" | "checkPermission";

/** 按错误码给出下一步动作；无特定建议时返回 null，避免误导用户。 */
export function errorActionOf(err: AppError): ErrorAction | null {
  switch (err.code) {
    case "SYNC_4002":
      return "retry";
    case "SYNC_4003":
      return "relogin";
    case "SYNC_4004":
      return "checkPermission";
    default:
      return null;
  }
}
