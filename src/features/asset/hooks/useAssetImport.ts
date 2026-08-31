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

/** 拖放监听：随 view 变更/卸载重挂，导入成功后由调用方插入引用 */
function useAssetDropListener(
  view: EditorView | null,
  importPath: ReturnType<typeof useImportAssetMutation>,
  insert: (asset: AssetInfo, name: string) => void,
  fail: (error: unknown) => void
) {
  useEffect(() => {
    if (!view) return;
    let unlisten: (() => void) | undefined;
    void onDropPaths((paths) => {
      paths.forEach((path) => {
        importPath.mutate(path, {
          onSuccess: (asset) => insert(asset, basename(path)),
          onError: fail,
        });
      });
    }).then((off) => {
      unlisten = off;
    });
    return () => {
      unlisten?.();
    };
  }, [view, importPath, insert, fail]);
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
      files.forEach((file) => {
        void file.arrayBuffer().then((buffer) => {
          importBytes.mutate(
            { bytes: new Uint8Array(buffer), fileName: file.name },
            { onSuccess: (asset) => insert(asset, file.name), onError: fail }
          );
        });
      });
    },
    [importBytes, insert, fail]
  );

  return { handleFiles, status };
}
