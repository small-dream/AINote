import type { EditorState } from "@codemirror/state";
import type { FormatResult } from "@/features/note/utils/format";

/** 协议正则（http/https/data/…），排除 Windows 盘符 `C:\` */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function isDrivePath(src: string): boolean {
  return /^[a-z]:[\\/]/i.test(src);
}

/** 是否为外部协议 URL（非本地文件路径） */
function isExternalUrl(src: string): boolean {
  return SCHEME.test(src) && !isDrivePath(src);
}

/** 从本地/仓库路径取文件名（同时兼容 `\` 与 `/` 分隔符） */
export function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  return normalized.slice(normalized.lastIndexOf("/") + 1) || normalized;
}

/** 图片引用：在光标处插入 ![文件名](assets/xxx.png)（仓库相对路径，跨设备可移植） */
export function insertAssetImage(state: EditorState, repoPath: string, name: string): FormatResult {
  const { from, to } = state.selection.main;
  const insert = `![${name}](${repoPath})`;
  return {
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  };
}

/** 把 Markdown 图片 src 解析为本地绝对路径；外部 URL / 空返回 null（交由原样渲染） */
export function resolveLocalAssetPath(repoPath: string, src: string): string | null {
  const s = src.trim();
  if (!s || isExternalUrl(s)) return null;
  if (s.startsWith("/") || isDrivePath(s)) return s;
  const root = repoPath.replace(/[\\/]+$/, "");
  return `${root}/${s}`.replace(/\\/g, "/");
}
