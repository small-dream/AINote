/** 为预览标题生成稳定、可读且可重复的锚点。 */
export function slugifyHeading(value: string): string {
  const slug = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
}

/** 从 React children 中提取纯文本，供代码复制按钮使用。 */
export function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (value && typeof value === "object" && "props" in value) {
    const props = (value as { props?: { children?: unknown } }).props;
    return textContent(props?.children);
  }
  return "";
}
