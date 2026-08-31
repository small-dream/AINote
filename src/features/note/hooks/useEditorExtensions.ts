import { useMemo, useState } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useUiStore } from "@/stores/ui.store";
import { dispatchFormat, dispatchLink } from "./useFormatCommands";
import { getActiveFormats, toggleInline } from "../utils/format";
import { getAinoteEditorTheme } from "./editorTheme";

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

/** 编辑器扩展集合 + 光标激活格式集合（选择/文档变化时经 updateListener 刷新） */
export function useEditorExtensions(): { extensions: Extension[]; activeFormats: Set<string> } {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(() => new Set());
  const theme = useUiStore((s) => s.theme);
  const extensions = useMemo(
    () => [
      getAinoteEditorTheme(theme === "dark"),
      markdown({ extensions: [GFM] }),
      formatKeymap,
      EditorView.updateListener.of((update) => {
        if (update.selectionSet || update.docChanged) {
          setActiveFormats(getActiveFormats(update.state));
        }
      }),
    ],
    [theme]
  );
  return { extensions, activeFormats };
}
