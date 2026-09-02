import type { AiWriteAction } from "../utils/prompts";

/** useAiWrite 返回值类型（供 AiWriteControls 引用，避免循环 import） */
export interface UseAiWriteReturn {
  menuOpen: boolean;
  loading: boolean;
  preview: string | null;
  error: string | null;
  hasSelection: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  run: (action: AiWriteAction) => Promise<void>;
  retry: () => void;
  confirm: () => void;
  cancel: () => void;
}
