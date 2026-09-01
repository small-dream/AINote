import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type GetReferenceClientRect, type Instance } from "tippy.js";
import CommandList, { type CommandListRef } from "../components/SlashCommandList";
import { filterSlashCommands, type SlashCommandDef } from "../utils/slashCommands";

/** 斜杠命令浮层：用 tippy 挂载 CommandList 到 body */
function renderSlashCommandSuggestions(editor: Editor) {
  let component: ReactRenderer<CommandListRef> | null = null;
  let popup: Instance | null = null;
  return {
    onStart: (props: SuggestionProps<SlashCommandDef>) => {
      component = new ReactRenderer(CommandList, { props, editor });
      if (!props.clientRect) return;
      popup = tippy("body", {
        getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
      })[0] ?? null;
    },
    onUpdate: (props: SuggestionProps<SlashCommandDef>) => {
      component?.updateProps(props);
      if (props.clientRect) popup?.setProps({ getReferenceClientRect: props.clientRect as GetReferenceClientRect });
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (props.event.key === "Escape") {
        popup?.hide();
        return true;
      }
      return component?.ref?.onKeyDown(props) ?? false;
    },
    onExit: () => {
      popup?.destroy();
      popup = null;
      component?.destroy();
      component = null;
    },
  };
}

/** 斜杠命令：输入 `/` 弹出命令菜单，回车/点击执行块转换与插入 */
export const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        allow: ({ state, range }: { state: { doc: { textBetween: (from: number, to: number) => string } }; range: { from: number } }) => {
          const before = state.doc.textBetween(range.from - 1, range.from);
          return before === "" || /\s/.test(before);
        },
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommandDef }) => {
          void editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        items: ({ query }: { query: string }) => filterSlashCommands(query),
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandDef>({
        editor: this.editor,
        ...this.options.suggestion,
        render: () => renderSlashCommandSuggestions(this.editor),
      }),
    ];
  },
});
