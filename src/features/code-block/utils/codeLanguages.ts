import { createLowlight, common } from "lowlight";

const LANGUAGE_LABELS: Record<string, string> = {
  arduino: "Arduino", bash: "Bash", c: "C", cpp: "C++", csharp: "C#", css: "CSS",
  diff: "Diff", go: "Go", graphql: "GraphQL", ini: "INI", java: "Java",
  javascript: "JavaScript", json: "JSON", kotlin: "Kotlin", less: "Less", lua: "Lua",
  makefile: "Makefile", markdown: "Markdown", objectivec: "Objective-C", perl: "Perl",
  php: "PHP", "php-template": "PHP Template", plaintext: "Plain Text", python: "Python",
  "python-repl": "Python REPL", r: "R", ruby: "Ruby", rust: "Rust", scss: "SCSS",
  shell: "Shell", sql: "SQL", swift: "Swift", typescript: "TypeScript", vbnet: "VB.NET",
  wasm: "WebAssembly", xml: "XML", yaml: "YAML",
};

const lowlight = createLowlight(common);

/** 可复用的代码语言列表：预览、富文本与软渲染共用同一份标识符和显示名。 */
export const CODE_LANGUAGES: ReadonlyArray<{ id: string; label: string }> = lowlight
  .listLanguages()
  .map((id) => ({ id, label: LANGUAGE_LABELS[id] ?? id }));

/** 确保 select 中存在当前语言选项（支持 Markdown 里出现的别名，如 ts / js）。 */
export function syncLanguageOptions(select: HTMLSelectElement, language: string): void {
  if (!language) return;
  const exists = [...select.options].some((option) => option.value === language);
  if (exists) return;
  const option = document.createElement("option");
  option.value = language;
  option.textContent = language;
  select.append(option);
}
