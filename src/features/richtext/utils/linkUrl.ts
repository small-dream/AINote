/** 富文本链接输入的 URL 校验与“请求打开输入框”事件（Mod-k / 斜杠命令 / 按钮共用入口） */

/** Mod-k 等入口不直接持有弹层状态，改为在编辑器 DOM 上派发事件，由唯一的 LinkButton 响应 */
export const LINK_INPUT_EVENT = "ainote:richtext-link-input";

/** 从编辑器 keymap 触发链接输入：事件冒泡到 window，由第一个注册的 LinkButton 独占响应 */
export function requestLinkInput(target: HTMLElement): void {
  target.dispatchEvent(new CustomEvent(LINK_INPUT_EVENT, { bubbles: true }));
}

const FULL_URL = /^https?:\/\/\S+$/i;
/** mailto、页内锚点、站内相对路径允许原样通过 */
const ALLOWED_SCHEME = /^(mailto:[^\s]+|#|\/|\.\/|\.\.\/)/;
/** 裸域名（example.com/path）自动补 https:// */
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/;

/**
 * 规范化用户输入的链接：合法则返回可写入 href 的值，非法返回 null。
 * 空字符串返回 null（由调用方决定视为“取消/解除链接”语义）。
 */
export function normalizeLinkUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (FULL_URL.test(url) || ALLOWED_SCHEME.test(url)) return url;
  if (BARE_DOMAIN.test(url)) return `https://${url}`;
  return null;
}
