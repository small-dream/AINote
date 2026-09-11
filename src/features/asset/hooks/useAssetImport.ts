import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { messageOf, onDropPaths, type AssetInfo } from "@/api";
import { dispatchFormat } from "@/features/note/hooks/useFormatCommands";
import {
  useImportAssetBytesMutation,
  useImportAssetMutation,
} from "@/queries/asset.queries";
import { useTranslation } from "@/i18n";
import { basename, insertAssetImage } from "../utils/asset";
import { splitImageFiles, watchDragInside, MAX_IMAGE_BYTES } from "../utils/importFiles";

const STATUS_CLEAR_MS = 3000;

/** 瞬时状态提示：3s 后自动清除 */
function useTransientStatus() {
  const [status, setStatus] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setStatus(null), STATUS_CLEAR_MS);
  }, []);
  return { status, showStatus };
}

/** 拖放监听：随 view 变更/卸载重挂；仅当拖拽悬停在编辑器区域内时才导入（shared 门禁） */
function useAssetDropListener(
  view: EditorView | null,
  importPath: ReturnType<typeof useImportAssetMutation>,
  insert: (asset: AssetInfo, name: string) => void,
  fail: (error: unknown) => void
) {
  useEffect(() => {
    if (!view) return;
    const gate = watchDragInside(view.contentDOM);
    let unlisten: (() => void) | undefined;
    void onDropPaths((paths) => {
      if (!gate.isInside()) return;
      paths.forEach((path) => {
        importPath.mutate(path, {
          onSuccess: (asset) => insert(asset, basename(path)),
          onError: fail,
        });
      });
    }).then((off) => {
      unlisten = off;
    }).catch(() => {
      // 非 Tauri 环境（纯浏览器 dev）无拖放事件源，静默降级
    });
    return () => {
      unlisten?.();
      gate.dispose();
    };
  }, [view, importPath, insert, fail]);
}

/** 剪贴板粘贴监听：clipboardData 中的图片走字节导入管线，纯文本粘贴保持默认行为 */
function useAssetPasteListener(view: EditorView | null, handleFiles: (files: File[]) => void) {
  useEffect(() => {
    const dom = view?.contentDOM;
    if (!dom) return;
    const onPaste = (event: ClipboardEvent) => {
      const { images, oversized } = splitImageFiles(event.clipboardData?.files ?? []);
      if (images.length === 0 && oversized.length === 0) return;
      event.preventDefault();
      handleFiles([...images, ...oversized]);
    };
    dom.addEventListener("paste", onPaste);
    return () => dom.removeEventListener("paste", onPaste);
  }, [view, handleFiles]);
}

/** P1-4 资产导入编排：文件拖放 + 工具栏选择器 → 复制到 assets/ → 光标处插入引用 */
export function useAssetImport(view: EditorView | null) {
  const { t } = useTranslation();
  const importPath = useImportAssetMutation();
  const importBytes = useImportAssetBytesMutation();
  const { status, showStatus } = useTransientStatus();

  const insert = useCallback(
    (asset: AssetInfo, name: string) => {
      if (!view) return;
      dispatchFormat(view, (s) => insertAssetImage(s, asset.path, name));
      view.focus();
      showStatus(t("note.assetImported", { name }));
    },
    [view, showStatus, t]
  );

  const fail = useCallback(
    (error: unknown) => {
      showStatus(t("note.assetFailed", { message: messageOf(error) }));
    },
    [showStatus, t]
  );

  useAssetDropListener(view, importPath, insert, fail);

  const handleFiles = useCallback(
    (files: File[]) => {
      const { images, oversized } = splitImageFiles(files);
      oversized.forEach((file) => {
        showStatus(
          t("note.assetTooLarge", {
            name: file.name,
            limit: Math.round(MAX_IMAGE_BYTES / 1024 / 1024),
          })
        );
      });
      images.forEach((file) => {
        void file.arrayBuffer().then((buffer) => {
          importBytes.mutate(
            { bytes: new Uint8Array(buffer), fileName: file.name },
            { onSuccess: (asset) => insert(asset, file.name), onError: fail }
          );
        }).catch(fail);
      });
    },
    [importBytes, insert, fail, showStatus, t]
  );

  useAssetPasteListener(view, handleFiles);

  return { handleFiles, status };
}
