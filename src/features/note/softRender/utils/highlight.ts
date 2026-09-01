import { createLowlight, common } from "lowlight";
import type { Element, Root } from "hast";

const lowlight = createLowlight(common);

type HastParent = Root | Element;

/** 使用 lowlight/highlight.js 把源码高亮为 DOM 树。 */
export function highlightCode(source: string, language: string | null): HTMLElement {
  const root = language ? lowlight.highlight(language, source) : lowlight.highlightAuto(source);
  const pre = document.createElement("pre");
  pre.className = "hljs cm-sr-codeblock-pre";
  const code = document.createElement("code");
  code.className = language ? `cm-sr-codeblock-code language-${language}` : "cm-sr-codeblock-code";
  appendHastChildren(code, root);
  pre.appendChild(code);
  return pre;
}

function appendHastChildren(parent: HTMLElement, node: HastParent): void {
  for (const child of node.children) {
    if (child.type === "text") {
      parent.appendChild(document.createTextNode(child.value));
      continue;
    }
    if (child.type === "element") {
      const el = document.createElement(child.tagName);
      const className = child.properties?.className;
      if (className) el.className = Array.isArray(className) ? className.join(" ") : String(className);
      appendHastChildren(el, child);
      parent.appendChild(el);
    }
  }
}

/** 判断 lowlight 是否支持该语言。 */
export function isLanguageSupported(language: string): boolean {
  if (!language) return false;
  return lowlight.listLanguages().includes(language.toLocaleLowerCase());
}
