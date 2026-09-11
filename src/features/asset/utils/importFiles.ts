/** 图片粘贴/拖放的共享准入工具：Markdown 与富文本两条导入链路复用（shared） */

/** 单张图片大小上限（字节）：超出即拒绝导入，避免仓库被截图/相机原图撑爆 */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface ImageFileSplit {
  /** 可导入的图片文件 */
  images: File[];
  /** 图片但超过大小上限，需提示用户 */
  oversized: File[];
}

/** 过滤非图片文件，并按大小上限分流（clipboardData/dataTransfer.files 直接传入） */
export function splitImageFiles(files: Iterable<File>, maxBytes = MAX_IMAGE_BYTES): ImageFileSplit {
  const images: File[] = [];
  const oversized: File[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    (file.size > maxBytes ? oversized : images).push(file);
  }
  return { images, oversized };
}

export interface DragInsideGate {
  isInside: () => boolean;
  dispose: () => void;
}

/**
 * 追踪 OS 级拖拽（Tauri onDropPaths）是否悬停在指定编辑器区域内。
 * Tauri 拖放回调拿不到 DOM 目标，只能靠 dragover 期间的悬停状态在 drop 时判定。
 */
export function watchDragInside(target: Element): DragInsideGate {
  let inside = false;
  const markInside = () => {
    inside = true;
  };
  const onDragLeave = (event: Event) => {
    const related = (event as DragEvent).relatedTarget;
    if (!related || !target.contains(related as Node)) inside = false;
  };
  const markOutside = () => {
    inside = false;
  };
  target.addEventListener("dragenter", markInside);
  target.addEventListener("dragover", markInside);
  target.addEventListener("dragleave", onDragLeave);
  window.addEventListener("drop", markOutside);
  window.addEventListener("dragend", markOutside);
  return {
    isInside: () => inside,
    dispose: () => {
      target.removeEventListener("dragenter", markInside);
      target.removeEventListener("dragover", markInside);
      target.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", markOutside);
      window.removeEventListener("dragend", markOutside);
    },
  };
}
