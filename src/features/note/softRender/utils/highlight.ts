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
export function highlightCode(source: string, language: string | null): HTMLPreElement {
  const pre = document.createElement("pre");
  pre.className = "hljs cm-sr-codeblock-pre";
  const code = document.createElement("code");
  code.className = language ? `cm-sr-codeblock-code language-${language}` : "cm-sr-codeblock-code";
  code.textContent = source;
  applyCodeLines(code);
  pre.appendChild(code);
  void loadLowlight().then((lowlight) => {
    const root = language ? lowlight.highlight(language, source) : lowlight.highlightAuto(source);
    // highlightAuto 对无法识别的纯文本会返回空结果树；此时保留已写入的源码，
    // 否则无语言标记的围栏代码块（例如 `| dedup devid`）会被清成空白。
    if (root.children.length === 0) return;
    code.replaceChildren();
    appendHastChildren(code, root);
    applyCodeLines(code);
  }).catch(() => undefined);
  return pre;
}

/** 把高亮结果按源码换行拆成独立行，供左侧行号与逐行布局使用。 */
function applyCodeLines(code: HTMLElement): void {
  const source = code.textContent ?? "";
  const ranges = lineRanges(source);
  const fragments = ranges.map(({ from, to }) => sliceContents(code, from, to));
  const children: Node[] = fragments.flatMap((fragment, index) => {
    const line = document.createElement("div");
    line.className = "cm-sr-codeblock-render-line";
    line.dataset.line = String(index + 1);
    const content = document.createElement("span");
    content.className = "cm-sr-codeblock-render-content";
    content.append(fragment);
    line.append(content);
    if (index === fragments.length - 1) return [line];
    const newline = document.createElement("span");
    newline.className = "cm-sr-codeblock-line-break";
    newline.textContent = "\n";
    return [line, newline];
  });
  code.replaceChildren(...children);
}

function lineRanges(source: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  let from = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== "\n") continue;
    ranges.push({ from, to: index });
    from = index + 1;
  }
  ranges.push({ from, to: source.length });
  return ranges;
}

function sliceContents(root: HTMLElement, from: number, to: number): DocumentFragment {
  const range = document.createRange();
  const start = locateTextOffset(root, from);
  const end = locateTextOffset(root, to);
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range.cloneContents();
}

function locateTextOffset(root: HTMLElement, target: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = target;
  let last: Text | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    last = text;
    if (remaining <= text.data.length) return { node: text, offset: remaining };
    remaining -= text.data.length;
  }
  return last ? { node: last, offset: last.data.length } : { node: root, offset: 0 };
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
