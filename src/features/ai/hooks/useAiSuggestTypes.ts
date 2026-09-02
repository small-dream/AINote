import type { AiSuggestKind } from "../utils/prompts";

/** useAiSuggest 返回值类型（供 AiSuggestDialog 引用，避免循环 import） */
export interface UseAiSuggestReturn {
  kind: AiSuggestKind | null;
  loading: boolean;
  text: string;
  error: string | null;
  titles: string[];
  startTitle: () => void;
  startOutline: () => void;
  pickTitle: (title: string) => void;
  insertOutline: () => void;
  close: () => void;
}
