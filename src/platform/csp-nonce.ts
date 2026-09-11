/**
 * 读取桌面 / 移动壳注入的 CSP nonce。
 *
 * 生产壳（Tauri）会把 index.html 内联 `<style>` 打上随机 nonce，并把 `'nonce-…'`
 * 追加进 CSP 的 style-src；按 CSP3 规则，指令里一旦出现 nonce，`'unsafe-inline'`
 * 即被忽略，运行时注入的 `<style>`（CodeMirror / style-mod 等）必须带上同一个
 * nonce 才会生效。dev（Vite dev server 直连）与纯浏览器环境没有该属性，返回 undefined。
 */
export function readCspNonce(doc: Document | undefined = typeof document === "undefined" ? undefined : document): string | undefined {
  if (!doc) return undefined;
  return readNonce(doc, "style") ?? readNonce(doc, "script");
}

function readNonce(doc: Document, selector: "style" | "script"): string | undefined {
  for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
    // nonce 属性加载后会被浏览器「隐藏」（getAttribute 返回空串），IDL 属性仍可读到原值。
    const value = element.nonce || element.getAttribute("nonce") || "";
    if (value) return value;
  }
  return undefined;
}
