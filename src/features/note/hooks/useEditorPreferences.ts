import { useCallback, useState } from "react";
import type { EditorPreferences } from "../utils/editorPreferences";
import { readEditorPreferences, writeEditorPreferences } from "../utils/editorPreferences";

export function useEditorPreferences(repoPath: string | null, notePath: string | null) {
  const [, setRevision] = useState(0);
  const preferences = readEditorPreferences(repoPath, notePath);

  const update = useCallback((patch: Partial<EditorPreferences>) => {
    const next = { ...readEditorPreferences(repoPath, notePath), ...patch };
    writeEditorPreferences(repoPath, notePath, next);
    setRevision((value) => value + 1);
  }, [repoPath, notePath]);

  return {
    preferences,
    setMode: (mode: EditorPreferences["mode"]) => update({ mode }),
    setRatio: (ratio: number) => update({ ratio }),
    setEditorScrollTop: (editorScrollTop: number) => update({ editorScrollTop }),
    setPreviewScrollTop: (previewScrollTop: number) => update({ previewScrollTop }),
  };
}
