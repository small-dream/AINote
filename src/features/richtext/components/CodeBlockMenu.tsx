import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useTranslation } from "@/i18n";
import { CODE_LANGUAGES } from "../extensions/codeBlock";

interface CodeBlockMenuProps {
  editor: Editor | null;
}

/** 代码块语言选择浮层：光标位于代码块内时显示，切换后更新代码块 language 属性。 */
export function CodeBlockMenu({ editor }: CodeBlockMenuProps) {
  const { t } = useTranslation();
  if (!editor) return null;
  const language = (editor.getAttributes("codeBlock").language as string | null) ?? "";
  const handleChange = (value: string) => {
    editor.chain().focus().updateAttributes("codeBlock", { language: value || null }).run();
  };
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: current }) => current.isActive("codeBlock") && current.isEditable}
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-2 py-1.5 shadow-lg">
        <label htmlFor="code-language" className="text-xs text-text-secondary">{t("richtext.codeLanguage")}</label>
        <select
          id="code-language"
          aria-label={t("richtext.codeLanguage")}
          value={language}
          onMouseDown={(event) => event.stopPropagation()}
          onChange={(event) => handleChange(event.target.value)}
          className="max-w-44 rounded-md border border-border bg-bg-secondary px-2 py-0.5 text-xs text-text-primary outline-none focus:border-accent"
        >
          <option value="">{t("richtext.autoDetect")}</option>
          {CODE_LANGUAGES.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>
    </BubbleMenu>
  );
}
