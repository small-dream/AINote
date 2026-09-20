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
  /** 认证类错误才有：需要登录的托管平台 id（后端按目标平台回填） */
  provider?: string;
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

/**
 * 认证类错误对应的托管平台 id：据此可直接引导用户登录该平台。
 * 无平台信息（如过期凭证来自 git 层）时返回 null，调用方不应猜测平台。
 */
export function loginProviderOf(err: unknown): string | null {
  if (!isAppError(err) || err.kind !== "auth") return null;
  return err.provider ?? null;
}

/** 同步类错误对应的可操作建议 */
export type ErrorAction = "retry" | "relogin" | "checkPermission" | "resolveConflicts";

/**
 * 后端建议码 → 动作。`resolveConflicts` 有明确动作（打开冲突面板），
 * 关键是**不能**退回「重试」——对冲突重试只会原样再失败一次。
 */
const HINT_ACTION: Record<SyncHint, ErrorAction | null> = {
  retry: "retry",
  relogin: "relogin",
  checkPermission: "checkPermission",
  resolveConflicts: "resolveConflicts",
};

/** 后端 hint 优先于错误码推断；hint 缺失时按错误码兜底。无特定建议时返回 null，避免误导用户。 */
export function errorActionOf(err: AppError): ErrorAction | null {
  if (err.hint) return HINT_ACTION[err.hint];
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
