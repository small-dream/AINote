import type { ChangedFile } from "@/api/types";

/** commit message 状态前缀，与 Rust domain/commit.rs 保持一致 */
export const STATUS_LETTER: Record<ChangedFile["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
};

/**
 * 手动提交默认 message（纯函数）：subject = `chore: <时间> · 更新 N 个文件`，
 * body 列出每个文件的变更类型与路径；无变更时返回空字符串。
 */
export function buildCommitMessage(files: ChangedFile[], date: Date): string {
  if (files.length === 0) return "";
  return [
    `chore: ${formatTimestamp(date)} · 更新 ${files.length} 个文件`,
    "",
    ...files.map((file) => `${STATUS_LETTER[file.status]} ${file.path}`),
  ].join("\n");
}

/** 本地时间 `YYYY-MM-DD HH:mm` */
export function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
