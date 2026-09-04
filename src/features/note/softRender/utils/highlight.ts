import type { Element, Root } from "hast";
import type { createLowlight } from "lowlight";

type Lowlight = ReturnType<typeof createLowlight>;
type HastParent = Root | Element;

let lowlightPromise: Promise<Lowlight> | null = null;

function loadLowlight(): Promise<Lowlight> {
  lowlightPromise ??= import("lowlight").then(({ createLowlight, common }) => createLowlight(common));
  return lowlightPromise;
}

/** 使用 lowlight/highlight.js 把源码高亮为 DOM 树。 */
export function highlightCode(source: string, language: string | null): HTMLElement {
  const pre = document.createElement("pre");
  pre.className = "hljs cm-sr-codeblock-pre";
  const code = document.createElement("code");
  code.className = language ? `cm-sr-codeblock-code language-${language}` : "cm-sr-codeblock-code";
  code.textContent = source;
  pre.appendChild(code);
  void loadLowlight().then((lowlight) => {
    const root = language ? lowlight.highlight(language, source) : lowlight.highlightAuto(source);
    code.replaceChildren();
    appendHastChildren(code, root);
  }).catch(() => undefined);
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
const COMMON_LANGUAGES = new Set([
  "arduino", "bash", "c", "cpp", "csharp", "css", "diff", "go", "graphql", "ini", "java",
  "javascript", "json", "kotlin", "less", "lua", "makefile", "markdown", "objectivec", "perl",
  "php", "php-template", "plaintext", "python", "python-repl", "r", "ruby", "rust", "scss", "shell",
  "sql", "swift", "typescript", "vbnet", "wasm", "xml", "yaml",
]);

export function isLanguageSupported(language: string): boolean {
  return Boolean(language) && COMMON_LANGUAGES.has(language.toLocaleLowerCase());
}
