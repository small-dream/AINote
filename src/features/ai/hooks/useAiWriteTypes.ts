import type { AiWriteAction } from "../utils/prompts";

/** useAiWrite 返回值类型（供 AiWriteControls 引用，避免循环 import） */
export interface UseAiWriteReturn {
  menuOpen: boolean;
  /** 预览确认框是否可见（取消后立即关闭，不受在途请求影响） */
  open: boolean;
  loading: boolean;
  preview: string | null;
  error: string | null;
  hasSelection: boolean;
  applyDocument: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  run: (action: AiWriteAction) => Promise<void>;
  retry: () => void;
  confirm: () => void;
  cancel: () => void;
}
