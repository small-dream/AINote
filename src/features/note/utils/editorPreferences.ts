import type { ViewMode } from "../components/EditorToolbar";

export const EDITOR_PREFERENCES_KEY = "ainote.editor-preferences";

export interface EditorPreferences {
  mode: ViewMode;
  ratio: number;
  editorScrollTop: number;
  previewScrollTop: number;
  /** Markdown 编辑是否使用软渲染（Typora 式所见即所得）；false = 源码模式 */
  softRender: boolean;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  mode: "edit",
  ratio: 0.5,
  editorScrollTop: 0,
  previewScrollTop: 0,
  softRender: true,
};

function storageKey(repoPath: string | null, notePath: string | null): string | null {
  if (!repoPath || !notePath) return null;
  return `${EDITOR_PREFERENCES_KEY}:${encodeURIComponent(repoPath)}:${encodeURIComponent(notePath)}`;
}

export function readEditorPreferences(repoPath: string | null, notePath: string | null): EditorPreferences {
  const key = storageKey(repoPath, notePath);
  if (!key || typeof localStorage === "undefined") return DEFAULT_EDITOR_PREFERENCES;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return normalizePreferences(raw);
  } catch {
    return DEFAULT_EDITOR_PREFERENCES;
  }
}

export function writeEditorPreferences(repoPath: string | null, notePath: string | null, value: EditorPreferences): void {
  const key = storageKey(repoPath, notePath);
  if (!key || typeof localStorage === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(normalizePreferences(value))); } catch { /* 存储不可用时不影响编辑 */ }
}

function normalizePreferences(value: unknown): EditorPreferences {
  if (!value || typeof value !== "object") return DEFAULT_EDITOR_PREFERENCES;
  const data = value as Partial<EditorPreferences>;
  return {
    mode: data.mode === "split" || data.mode === "preview" ? data.mode : "edit",
    ratio: clampNumber(data.ratio, 0.5, 0.2, 0.8),
    editorScrollTop: clampNumber(data.editorScrollTop, 0, 0, Number.MAX_SAFE_INTEGER),
    previewScrollTop: clampNumber(data.previewScrollTop, 0, 0, Number.MAX_SAFE_INTEGER),
    softRender: data.softRender !== false,
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
