/** `[[双链]]` 解析的纯函数，供输入规则与测试复用 */

export interface WikiLinkParts {
  target: string;
  alias: string | null;
}

/** 解析 `[[目标]]` / `[[目标|别名]]` 内部内容（不含方括号），返回目标与别名（已清理空白） */
export function parseWikiLink(raw: string): WikiLinkParts {
  const [target, alias] = raw.split("|");
  return { target: (target ?? "").trim(), alias: (alias ?? "").trim() || null };
}
