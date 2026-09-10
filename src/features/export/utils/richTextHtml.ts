import { Editor } from "@tiptap/core";
import { createRichTextExtensions } from "@/features/richtext/utils/extensions";

/**
 * 把 TipTap JSON（`.ainote` 笔记内容）序列化为打印用 HTML。
 * 与富文本编辑器共用扩展集合：图片仓库相对路径按 repoPath 解析为本地资产 URL；
 * 生成后立即销毁临时 Editor，无 DOM/React 依赖（与 markdownToRichTextJson 同模式）。
 */
export function richTextJsonToHtml(json: string, repoPath: string | null): string {
  if (!json.trim()) return "";
  try {
    const editor = new Editor({
      extensions: createRichTextExtensions(repoPath),
      content: JSON.parse(json),
    });
    try {
      return sanitizeRichTextHtml(editor.getHTML());
    } finally {
      editor.destroy();
    }
  } catch {
    return "";
  }
}

const SAFE_PROTOCOLS_BY_ATTR: Record<"href" | "src", ReadonlySet<string>> = {
  href: new Set(["http:", "https:", "mailto:"]),
  src: new Set(["http:", "https:", "asset:"]),
};

/** 协议白名单过滤：TipTap JSON 解析路径不校验链接协议，导出前剥离 javascript:/data: 等危险 href/src。
 * 相对路径、锚点与仓库资产（asset: 由 convertFileSrc 生成）保留；其余属性与结构原样透传。 */
export function sanitizeRichTextHtml(html: string): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const attr of ["href", "src"] as const) {
    for (const el of doc.querySelectorAll(`[${attr}]`)) {
      const value = el.getAttribute(attr);
      if (value !== null && !isSafeUrl(value, SAFE_PROTOCOLS_BY_ATTR[attr])) el.removeAttribute(attr);
    }
  }
  return doc.body.innerHTML;
}

/** 以占位 base 解析 URL：相对路径/锚点归一化为 https: 视为安全；C0 控制字符、实体编码与大小写混淆由解析器归一后按协议判定。 */
function isSafeUrl(value: string, protocols: ReadonlySet<string>): boolean {
  try {
    return protocols.has(new URL(value, "https://localhost/").protocol);
  } catch {
    return false;
  }
}
