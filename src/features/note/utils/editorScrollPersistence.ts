import type { EditorView } from "@codemirror/view";
import type { EditorPreferences } from "./editorPreferences";

export function attachEditorScrollPersistence(
  view: EditorView,
  preview: HTMLDivElement | null,
  preferences: Pick<EditorPreferences, "editorScrollTop" | "previewScrollTop">,
  onEditorScroll: (value: number) => void,
  onPreviewScroll: (value: number) => void,
): () => void {
  const editor = view.scrollDOM;
  editor.scrollTop = preferences.editorScrollTop;
  if (preview) preview.scrollTop = preferences.previewScrollTop;
  const saveEditor = () => onEditorScroll(editor.scrollTop);
  const savePreview = () => { if (preview) onPreviewScroll(preview.scrollTop); };
  editor.addEventListener("scroll", saveEditor, { passive: true });
  preview?.addEventListener("scroll", savePreview, { passive: true });
  return () => { editor.removeEventListener("scroll", saveEditor); preview?.removeEventListener("scroll", savePreview); };
}
