import { mergeAttributes } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

/** 基于 highlight.js 的 Lowlight 实例：注册常见语言，支持自动检测。 */
const lowlight = createLowlight(common);

const LANGUAGE_LABELS: Record<string, string> = {
  arduino: "Arduino", bash: "Bash", c: "C", cpp: "C++", csharp: "C#", css: "CSS",
  diff: "Diff", go: "Go", graphql: "GraphQL", ini: "INI", java: "Java",
  javascript: "JavaScript", json: "JSON", kotlin: "Kotlin", less: "Less", lua: "Lua",
  makefile: "Makefile", markdown: "Markdown", objectivec: "Objective-C", perl: "Perl",
  php: "PHP", "php-template": "PHP Template", plaintext: "Plain text", python: "Python",
  "python-repl": "Python REPL", r: "R", ruby: "Ruby", rust: "Rust", scss: "SCSS",
  shell: "Shell", sql: "SQL", swift: "Swift", typescript: "TypeScript", vbnet: "VB.NET",
  wasm: "WebAssembly", xml: "XML", yaml: "YAML",
};

/** 可选语言列表（lowlight common 已注册且去重后的标识符），供语言选择器使用。 */
export const CODE_LANGUAGES: ReadonlyArray<{ id: string; label: string }> = lowlight
  .listLanguages()
  .map((id) => ({ id, label: LANGUAGE_LABELS[id] ?? id }));

/** 代码块节点：在 Lowlight 语法高亮基础上，把语言写入 pre 的 data-language
 * 属性，供顶部语言徽标展示（替换 StarterKit 内置 codeBlock，同名扩展不能共存）。 */
export const CodeBlock = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }) {
    const language = node.attrs.language ?? null;
    return [
      "pre",
      mergeAttributes(HTMLAttributes, language ? { "data-language": language } : {}),
      ["code", { class: language ? `language-${language}` : null }, 0],
    ];
  },
}).configure({ lowlight });
