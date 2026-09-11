import { splitImageFiles } from "@/features/asset/utils/importFiles";

export interface RichTextDomHandlers {
  /** 图片文件（已过滤/分流）进入资产导入管线 */
  onFiles: (files: File[]) => void;
  /** Mod-k：请求打开链接 URL 输入框 */
  onRequestLink: () => void;
}

export interface RichTextDomListeners {
  dispose: () => void;
}

/** 富文本 Mod-k（与全局命令面板同键位，编辑器聚焦时优先） */
export function isModK(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "key">): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

/**
 * 编辑器区域级 DOM 监听（capture 阶段挂在 document，事件进入 ProseMirror 之前拦截）：
 * - paste/drop：clipboardData/dataTransfer 中的图片文件进入资产导入管线，其余保持默认
 * - keydown：Mod-k 打开链接输入；preventDefault + stopPropagation 阻断冒泡到 window 上的
 *   全局 ⌘K 命令面板（usePaletteShortcut），保证编辑器聚焦时编辑器优先
 * 仅当事件目标在 target（编辑器 DOM）内时才生效，天然实现“只在编辑器区域响应”。
 */
export function createRichTextDomListeners(target: HTMLElement, handlers: RichTextDomHandlers): RichTextDomListeners {
  const consumeFiles = (files: FileList | null | undefined): boolean => {
    const { images, oversized } = splitImageFiles(files ?? []);
    if (images.length === 0 && oversized.length === 0) return false;
    handlers.onFiles([...images, ...oversized]);
    return true;
  };
  const isInside = (event: Event): boolean => target.contains(event.target as Node);

  const onPaste = (event: Event) => {
    if (!isInside(event)) return;
    if (consumeFiles((event as ClipboardEvent).clipboardData?.files)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onDrop = (event: Event) => {
    if (!isInside(event)) return;
    if (consumeFiles((event as DragEvent).dataTransfer?.files)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onKeyDown = (event: Event) => {
    if (!isInside(event) || !isModK(event as KeyboardEvent)) return;
    event.preventDefault();
    event.stopPropagation();
    handlers.onRequestLink();
  };

  document.addEventListener("paste", onPaste, true);
  document.addEventListener("drop", onDrop, true);
  document.addEventListener("keydown", onKeyDown, true);
  return {
    dispose: () => {
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("keydown", onKeyDown, true);
    },
  };
}
