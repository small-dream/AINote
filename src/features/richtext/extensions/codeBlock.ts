import { mergeAttributes, type NodeViewRendererProps } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ViewMutationRecord } from "@tiptap/pm/view";
import { useUiStore } from "@/stores/ui.store";
import { mountCodeBlock } from "@/features/code-block/mountCodeBlock";

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

/** 确保 select 中存在当前语言选项（支持 Markdown 里出现的别名，如 ts / js）。 */
function syncLanguageOptions(select: HTMLSelectElement, language: string) {
  const exists = [...select.options].some((option) => option.value === language);
  if (language && !exists) {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    select.append(option);
  }
}

/** 构建底部语言下拉：填充选项、显示当前语言并绑定切换命令。 */
function createLanguageSelect(initialLanguage: string, onChange: (language: string | null) => void) {
  const select = document.createElement("select");
  select.className = "code-block-language";
  const autoOption = document.createElement("option");
  autoOption.value = "";
  const translate = () => {
    const chinese = useUiStore.getState().locale === "zh-CN";
    select.setAttribute("aria-label", chinese ? "代码语言" : "Code language");
    autoOption.textContent = chinese ? "自动检测" : "Auto detect";
  };
  translate();
  const unsubscribe = useUiStore.subscribe(translate);
  select.append(autoOption);
  for (const { id, label } of CODE_LANGUAGES) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = label;
    select.append(option);
  }
  syncLanguageOptions(select, initialLanguage);
  select.value = initialLanguage;
  select.addEventListener("change", () => {
    onChange(select.value || null);
  });
  select.addEventListener("mousedown", (event) => event.stopPropagation());
  return { select, unsubscribe };
}

/** 共享阅读式容器与底部语言选择，内容 DOM 仍由 ProseMirror 管理。 */
function createCodeBlockView() {
  return (props: NodeViewRendererProps) => {
    const { node } = props;
    const toolbar = document.createElement("div");
    toolbar.className = "note-code-language";
    toolbar.contentEditable = "false";
    toolbar.dataset.codeControl = "";
    const currentLanguage = node.attrs.language ?? "";
    const { select, unsubscribe } = createLanguageSelect(currentLanguage, (language) => {
      const position = props.getPos();
      if (position === undefined) return;
      const { state, dispatch } = props.view;
      const current = state.doc.nodeAt(position);
      if (current) dispatch(state.tr.setNodeMarkup(position, undefined, { ...current.attrs, language }));
    });
    toolbar.append(select);

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    if (node.attrs.language) code.className = `language-${node.attrs.language}`;
    pre.append(code);
    const mounted = mountCodeBlock({ pre, footer: toolbar, getSource: () => code.textContent ?? "" });
    const container = mounted.shell;
    container.classList.add("code-block-shell");
    return {
      dom: container,
      contentDOM: code,
      stopEvent: (event: Event) => event.target instanceof Element && Boolean(event.target.closest("[data-code-control]")),
      destroy: () => { unsubscribe(); mounted.destroy(); },
      update(updatedNode: ProseMirrorNode) {
        if (updatedNode.type !== node.type) return false;
        const language = updatedNode.attrs.language ?? "";
        syncLanguageOptions(select, language);
        select.value = language;
        code.className = language ? `language-${language}` : "";
        return true;
      },
      ignoreMutation(mutation: ViewMutationRecord) {
        if (!("target" in mutation)) return true;
        const target = mutation.target;
        return target !== code && !code.contains(target);
      },
    };
  };
}

/** 语言属性保留在静态 HTML；操作控件与换行状态不参与序列化。 */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return createCodeBlockView();
  },
  renderHTML({ node, HTMLAttributes }) {
    const language = node.attrs.language ?? null;
    return [
      "pre",
      mergeAttributes(HTMLAttributes, language ? { "data-language": language } : {}),
      ["code", { class: language ? `language-${language}` : null }, 0],
    ];
  },
}).configure({ lowlight });
