/** 时间戳（Unix 秒）格式化为本地 "YYYY-MM-DD HH:mm"（纯函数，便于测试） */
export function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
