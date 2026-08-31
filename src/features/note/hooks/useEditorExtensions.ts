import { useMemo, useState } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { useUiStore } from "@/stores/ui.store";
import type { NoteWikiDto } from "@/api/types";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { dispatchFormat, dispatchLink } from "./useFormatCommands";
import { getActiveFormats, toggleInline } from "../utils/format";
import { getListContinuation } from "../utils/markdownInput";
import { getAinoteEditorTheme } from "./editorTheme";
import { buildCompletions, getCompletionContext } from "../utils/completion";

/** 格式化快捷键（与工具栏按钮共用 dispatchFormat 逻辑） */
const formatKeymap = Prec.high(
  keymap.of([
    { key: "Mod-b", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "bold")) },
    { key: "Mod-i", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "italic")) },
    { key: "Mod-e", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "code")) },
    { key: "Mod-Shift-x", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "strikethrough")) },
    { key: "Mod-k", run: (v) => {
      void dispatchLink(v);
      return true;
    } },
  ])
);

const markdownInputKeymap = Prec.high(
  keymap.of([
    {
      key: "Enter",
      run: (view) => {
        const { state } = view;
        const selection = state.selection.main;
        if (!selection.empty) return false;
        const line = state.doc.lineAt(selection.head);
        const result = getListContinuation(line.text);
        if (!result.insert) return false;
        const change = result.exitList
          ? { from: line.from, to: line.to, insert: result.insert }
          : { from: selection.head, insert: result.insert };
        const cursor = result.exitList ? line.from + result.insert.length : selection.head + result.insert.length;
        view.dispatch({ changes: change, selection: { anchor: cursor }, scrollIntoView: true });
        return true;
      },
    },
  ])
);

/** 编辑器扩展集合 + 光标激活格式集合（选择/文档变化时经 updateListener 刷新） */
export function useEditorExtensions(notes: NoteWikiDto[] = []): { extensions: Extension[]; activeFormats: Set<string> } {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(() => new Set());
  const theme = useUiStore((s) => s.theme);
  const extensions = useMemo(
    () => [
      getAinoteEditorTheme(theme === "dark"),
      markdown({ extensions: [GFM] }),
      history(),
      search({ top: true }),
      highlightSelectionMatches(),
      closeBrackets(),
      bracketMatching(),
      indentOnInput(),
      EditorView.lineWrapping,
      autocompletion({ override: [(context) => completionSource(context, notes)] }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      markdownInputKeymap,
      formatKeymap,
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          setActiveFormats(getActiveFormats(update.state));
        }
      }),
    ],
    [theme, notes]
  );
  return { extensions, activeFormats };
}

function completionSource(context: CompletionContext, notes: Parameters<typeof buildCompletions>[0]) {
  const info = getCompletionContext(context.state, context.pos);
  if (!info) return null;
  return { from: info.from, options: buildCompletions(notes, info), validFor: /^[\p{L}\p{N}_/-]*$/u };
}
