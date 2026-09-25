import { useMemo, useState } from "react";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { EditorState, Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, redoDepth, undoDepth } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { useUiStore } from "@/stores/ui.store";
import type { NoteWikiDto } from "@/api/types";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { dispatchFormat, dispatchLink } from "./useFormatCommands";
import { getActiveFormats, toggleInline } from "../utils/format";
import { getListContinuation } from "../utils/markdownInput";
import { indentPastedText } from "../utils/pasteIndent";
import { getNoteThemeMode } from "../utils/noteThemes";
import { getAinoteEditorTheme, getAinoteHighlightStyle } from "./editorTheme";
import { buildCompletions, getCompletionContext } from "../utils/completion";
import { softRender } from "../softRender/plugin";
import { useTranslation } from "@/i18n";
import type { TranslationKey } from "@/i18n/messages";
import { readCspNonce } from "@/platform/csp-nonce";

export interface EditorExtensionsInput {
  notes?: NoteWikiDto[];
  repoPath?: string | null;
  onOpenWiki?: (name: string) => void;
  onLinkAction?: (href: string, point: { x: number; y: number }) => void;
  onLinkInput?: () => void;
  /** Markdown 编辑是否启用软渲染（WYSIWYG），false = 源码模式 */
  softRenderEnabled?: boolean;
}

/** 格式化快捷键（与工具栏按钮共用 dispatchFormat 逻辑） */
const formatKeymap = Prec.high(
  keymap.of([
    { key: "Mod-b", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "bold")) },
    { key: "Mod-i", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "italic")) },
    { key: "Mod-e", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "code")) },
    { key: "Mod-Shift-x", run: (v) => dispatchFormat(v, (s) => toggleInline(s, "strikethrough")) },
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
export function useEditorExtensions(input: EditorExtensionsInput = {}): { extensions: Extension[]; activeFormats: Set<string>; canUndo: boolean; canRedo: boolean } {
  const { notes = [], repoPath = null, onOpenWiki, onLinkAction, onLinkInput, softRenderEnabled = true } = input;
  const [activeFormats, setActiveFormats] = useState<Set<string>>(() => new Set());
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  const noteTheme = useUiStore((s) => s.noteTheme);
  const { t } = useTranslation();
  const extensions = useMemo(() => [
    getAinoteEditorTheme(getNoteThemeMode(noteTheme) === "dark"),
    // 打包壳的 style-src 带 nonce，CodeMirror 运行时注入的 <style> 必须携带同一 nonce。
    ...cspNonceExtension(),
    markdown({ extensions: [GFM] }),
    history(),
    searchExtension(t),
    highlightSelectionMatches(),
    closeBrackets(),
    bracketMatching(),
    indentOnInput(),
    EditorView.lineWrapping,
    autocompletion({ override: [(context) => completionSource(context, notes)] }),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdownInputKeymap,
    formatKeymap,
    Prec.high(keymap.of([{ key: "Mod-k", run: (view) => { if (onLinkInput) { onLinkInput(); return true; } void dispatchLink(view); return true; } }])),
    ...(softRenderEnabled ? softRenderExtension(repoPath, onOpenWiki, onLinkAction, t("note.copyCode"), t("note.copied")) : [syntaxHighlighting(getAinoteHighlightStyle())]),
    EditorView.updateListener.of((update) => {
      if (!update.selectionSet && !update.docChanged) return;
      // 只有激活格式真正变化才更新：否则每次移动光标/拖选都会触发重渲染，
      // 进而让 @uiw/react-codemirror 重建扩展，打断进行中的鼠标选择。
      const next = getActiveFormats(update.state);
      setActiveFormats((prev) => (sameFormats(prev, next) ? prev : next));
      setHistoryState((prev) => {
        const nextState = { canUndo: undoDepth(update.state) > 0, canRedo: redoDepth(update.state) > 0 };
        return prev.canUndo === nextState.canUndo && prev.canRedo === nextState.canRedo ? prev : nextState;
      });
    }),
  ], [noteTheme, notes, onLinkAction, onLinkInput, onOpenWiki, repoPath, softRenderEnabled, t]);
  return { extensions, activeFormats, ...historyState };
}

/** 生产壳（CSP 含 nonce）下放行 CodeMirror 注入的样式；无 nonce 环境返回空数组。 */
function cspNonceExtension(): Extension[] {
  const nonce = readCspNonce();
  return nonce ? [EditorView.cspNonce.of(nonce)] : [];
}

/**
 * 查找替换面板 + 中文短语 + 多行粘贴保持缩进。
 *
 * 短语表覆盖 CodeMirror 各包内建的英文文案（搜索面板按钮、跳转行对话框、
 * 屏幕阅读器播报），按中文界面显示；英文界面无需翻译，`t` 会返回原文。
 */
function searchExtension(t: (key: TranslationKey) => string): Extension {
  return [
    search({ top: true }),
    EditorState.phrases.of({
      Find: t("editor.find"),
      Replace: t("editor.replace"),
      next: t("editor.findNext"),
      previous: t("editor.findPrevious"),
      all: t("editor.findAllMatches"),
      "match case": t("editor.matchCase"),
      regexp: t("editor.useRegexp"),
      "by word": t("editor.wholeWord"),
      replace: t("editor.replaceOne"),
      "replace all": t("editor.replaceAll"),
      close: t("editor.closePanel"),
      "Go to line": t("editor.gotoLine"),
      go: t("editor.goto"),
      "on line": t("editor.gotoOnLine"),
      "current match": t("editor.currentMatch"),
      "replaced $ matches": t("editor.replacedMatches"),
      "replaced match on line $": t("editor.replacedMatchOnLine"),
      "Selection deleted": t("editor.selectionDeleted"),
      "folded code": t("editor.foldedCode"),
      unfold: t("editor.unfold"),
      to: t("editor.foldTo"),
      "Fold line": t("editor.foldLine"),
      "Unfold line": t("editor.unfoldLine"),
      "Folded lines": t("editor.foldedLines"),
      "Unfolded lines": t("editor.unfoldedLines"),
      Completions: t("editor.completions"),
      "Control character": t("editor.controlCharacter"),
    }),
    EditorView.clipboardInputFilter.of(indentPastedText),
  ];
}

function sameFormats(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function softRenderExtension(repoPath: string | null, onOpenWiki: ((name: string) => void) | undefined, onLinkAction: ((href: string, point: { x: number; y: number }) => void) | undefined, copyCodeLabel: string, copiedLabel: string): Extension[] {
  const options = { repoPath, copyCodeLabel, copiedLabel } as Parameters<typeof softRender>[0];
  if (onOpenWiki) options.onOpenWiki = onOpenWiki;
  if (onLinkAction) options.onLinkAction = onLinkAction;
  return [softRender(options)];
}

function completionSource(context: CompletionContext, notes: Parameters<typeof buildCompletions>[0]) {
  const info = getCompletionContext(context.state, context.pos);
  if (!info) return null;
  return { from: info.from, options: buildCompletions(notes, info), validFor: /^[\p{L}\p{N}_/-]*$/u };
}
