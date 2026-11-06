/* global process */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const NOTES_HEADING = "更新内容";

/**
 * 从 GitHub Release 正文里截取「更新内容」段落，作为 updater 清单的 `notes`。
 *
 * 说明随 `latest.json` 一次下发，客户端就不必再单独请求 GitHub API：
 * 更新检查走 Rust 侧网络栈，而那次请求走 WebView 网络栈，两者可达性并不一致
 * （Windows 上曾出现「检查到新版本但取不到说明」）。找不到该段落时回退整篇正文。
 */
export function extractUpdaterNotes(body) {
  // 去掉可能的 BOM：PowerShell 等工具重写正文时会带上，否则首行标题匹配不上。
  const text = (typeof body === "string" ? body : "").replace(/^\uFEFF/, "");
  if (!text.trim()) return "";

  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => isNotesHeading(line));
  if (start < 0) return text.trim();

  const section = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2}\s/.test(line)) break;
    section.push(line);
  }
  return section.join("\n").trim() || text.trim();
}

function isNotesHeading(line) {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  return Boolean(match) && match[1].length === 2 && match[2] === NOTES_HEADING;
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error("缺少 Release 正文文件参数");
  const notes = extractUpdaterNotes(fs.readFileSync(file, "utf8"));
  if (!notes) throw new Error("Release 正文没有可用的更新内容");
  process.stdout.write(notes);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
