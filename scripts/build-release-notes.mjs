/* global process, console */
import fs from "node:fs";

const tag = process.argv[2];
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? "")) {
  throw new Error(`版本标签必须是 vMAJOR.MINOR.PATCH，收到：${tag ?? "空"}`);
}

const changelog = fs.readFileSync("docs/CHANGELOG.md", "utf8");
const lines = changelog.split(/\r?\n/);
const start = lines.findIndex((line) => line.startsWith(`## ${tag} `));
if (start < 0) {
  throw new Error(`CHANGELOG 中没有 ${tag} 更新说明`);
}

const section = [];
for (const line of lines.slice(start + 1)) {
  if (line.startsWith("## ")) break;
  section.push(line);
}

const notes = section
  .filter((line) => line.trim() && !line.startsWith("#"))
  .join("\n")
  .trim();

if (!notes) {
  throw new Error(`CHANGELOG 中 ${tag} 没有更新说明`);
}

const installNotes = [
  "- Windows：下载 `.msi` 或 `.exe` 安装包。",
  "- macOS：Apple Silicon（Apple 芯片）Mac 下载 `.dmg` 安装包。",
  "- Linux：下载 `.AppImage`、`.deb` 或 `.rpm` 安装包。",
  "- 本版本支持应用内更新；可在 **设置 → 软件更新** 中检查更新。",
  "- macOS 安装包未签名。若浏览器下载后显示“已损坏”，将应用移至“应用程序”目录后执行 `xattr -cr /Applications/AINote.app`。",
  "- Windows 安装包未签名，首次运行时可能出现 SmartScreen 提示；请确认下载来源为本 Release 页面。",
].join("\n");

console.log(`## 更新内容\n\n${notes}\n\n## 安装与更新\n\n${installNotes}`);
