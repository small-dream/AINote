import { useCallback, useMemo, useState } from "react";
import type { EditorPreferences } from "../utils/editorPreferences";
import { readEditorPreferences, writeEditorPreferences } from "../utils/editorPreferences";

export function useEditorPreferences(repoPath: string | null, notePath: string | null) {
  const preferenceKey = `${repoPath ?? ""}\u0000${notePath ?? ""}`;
  const [stored, setStored] = useState(() => ({
    key: preferenceKey,
    value: readEditorPreferences(repoPath, notePath),
  }));
  const preferences = useMemo(
    () => stored.key === preferenceKey ? stored.value : readEditorPreferences(repoPath, notePath),
    [preferenceKey, repoPath, notePath, stored]
  );

  const update = useCallback((patch: Partial<EditorPreferences>) => {
    const next = { ...readEditorPreferences(repoPath, notePath), ...patch };
    writeEditorPreferences(repoPath, notePath, next);
    setStored({ key: preferenceKey, value: next });
  }, [preferenceKey, repoPath, notePath]);

  const persistScroll = useCallback((patch: Partial<EditorPreferences>) => {
    const next = { ...readEditorPreferences(repoPath, notePath), ...patch };
    writeEditorPreferences(repoPath, notePath, next);
  }, [repoPath, notePath]);

  const setMode = useCallback((mode: EditorPreferences["mode"]) => update({ mode }), [update]);
  const setRatio = useCallback((ratio: number) => update({ ratio }), [update]);
  const setEditorScrollTop = useCallback((editorScrollTop: number) => persistScroll({ editorScrollTop }), [persistScroll]);
  const setPreviewScrollTop = useCallback((previewScrollTop: number) => persistScroll({ previewScrollTop }), [persistScroll]);
  const toggleSoftRender = useCallback(
    () => update({ softRender: !readEditorPreferences(repoPath, notePath).softRender }),
    [update, repoPath, notePath]
  );

  return {
    preferences,
    setMode,
    setRatio,
    setEditorScrollTop,
    setPreviewScrollTop,
    toggleSoftRender,
  };
}
