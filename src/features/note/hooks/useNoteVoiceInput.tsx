import { useCallback, useRef, type ReactNode, type RefObject } from "react";
import type { EditorView } from "@codemirror/view";
import { useVoiceInput, VoiceMicButton } from "@/features/voice-input";
import { isMobileApp } from "@/platform/runtime";

interface UseNoteVoiceInputOptions {
  notePath: string | null;
  /** Markdown（CodeMirror）编辑器视图：光标处插入定稿文本。 */
  viewRef: RefObject<EditorView | null>;
  draft: string;
  onChange: (content: string) => void;
}

/**
 * 笔记编辑器的语音输入接线：Markdown 在 CodeMirror 光标处插入定稿，
 * 富文本经注册回调插入；两种编辑器都未就绪时兜底追加到文末（转写永不丢失）。
 * 返回的工具栏插槽只在移动壳渲染，桌面恒为 null。
 */
export function useNoteVoiceInput({ notePath, viewRef, draft, onChange }: UseNoteVoiceInputOptions): {
  slot: ReactNode;
  onRegisterRichTextInsert: (insert: ((text: string) => void) | null) => void;
  consent: { open: boolean; onConfirm: () => void; onCancel: () => void };
} {
  const richTextInsertRef = useRef<((text: string) => void) | null>(null);
  const onRegisterRichTextInsert = useCallback((insert: ((text: string) => void) | null) => {
    richTextInsertRef.current = insert;
  }, []);
  const insertSpokenText = useCallback(
    (text: string) => {
      if (richTextInsertRef.current) {
        richTextInsertRef.current(text);
        return;
      }
      const view = viewRef.current;
      if (view) {
        const head = view.state.selection.main.head;
        view.dispatch({ changes: { from: head, insert: text }, selection: { anchor: head + text.length } });
        view.focus();
        return;
      }
      onChange(draft ? `${draft}\n\n${text}` : text);
    },
    [draft, onChange, viewRef],
  );
  const mobile = isMobileApp();
  const voice = useVoiceInput({ insertText: insertSpokenText, notePath, enabled: mobile });
  const slot = mobile && voice.supported ? (
    <VoiceMicButton status={voice.status} partial={voice.partial} onToggle={() => void voice.toggle()} />
  ) : null;
  return {
    slot,
    onRegisterRichTextInsert,
    consent: {
      open: voice.consentOpen,
      onConfirm: () => void voice.confirmNetwork(),
      onCancel: voice.cancelConsent,
    },
  };
}
