import { isLocalStorageAvailable } from "@/stores/ui.store";
import { addLocalDays, localDateString } from "./task";

/** 「该仓库当天已提示过启动摘要」的本机记录键（纯前端 UI 态，不进仓库、不同步） */
export const STARTUP_DIGEST_STORAGE_KEY = "ainote.todo-startup-digest";

/** 记录保留天数：只为「当天是否提示过」服务，更早的条目没有意义 */
export const DIGEST_LOG_RETENTION_DAYS = 7;

type DigestLog = Record<string, string>;

const storageAvailable = isLocalStorageAvailable();

/** localStorage 不可用时的内存降级：当次运行内仍然能按天去重 */
let memoryLog: DigestLog = {};

function parseLog(raw: string | null): DigestLog {
  try {
    const value = JSON.parse(raw ?? "{}") as unknown;
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function readLog(): DigestLog {
  if (!storageAvailable) return memoryLog;
  return parseLog(localStorage.getItem(STARTUP_DIGEST_STORAGE_KEY));
}

function writeLog(log: DigestLog): void {
  if (!storageAvailable) {
    memoryLog = log;
    return;
  }
  try {
    localStorage.setItem(STARTUP_DIGEST_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // 配额满 / 被禁用：退回内存记录，本次运行内仍然不重复提示
    memoryLog = log;
  }
}

/** 键尾部的本地日期（`${repoPath}@YYYY-MM-DD`）；解析不出来的一律保留，宁可多存也不误删 */
function entryDay(key: string): string | null {
  const day = key.slice(key.lastIndexOf("@") + 1);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/** 裁掉保留期之外的条目 */
function prune(log: DigestLog, now: Date): DigestLog {
  const cutoff = localDateString(addLocalDays(now, -DIGEST_LOG_RETENTION_DAYS));
  return Object.fromEntries(
    Object.entries(log).filter(([key]) => {
      const day = entryDay(key);
      return day === null || day >= cutoff;
    }),
  );
}

/** 该仓库当天是否已经提示过启动摘要 */
export function hasPromptedDigest(key: string): boolean {
  return readLog()[key] !== undefined;
}

/** 记下「该仓库当天已提示过」；写入顺带裁掉过期条目 */
export function markDigestPrompted(key: string, now: Date): void {
  writeLog({ ...prune(readLog(), now), [key]: now.toISOString() });
}
