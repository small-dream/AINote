import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { messageOf, onDropPaths } from "@/api";
import {
  useImportAssetBytesMutation,
  useImportAssetMutation,
} from "@/queries/asset.queries";
import { useTranslation } from "@/i18n";
import { basename } from "@/features/asset/utils/asset";
import { splitImageFiles, watchDragInside, MAX_IMAGE_BYTES } from "@/features/asset/utils/importFiles";
import { createRichTextDomListeners } from "../utils/domHandlers";
import { requestLinkInput } from "../utils/linkUrl";

const STATUS_CLEAR_MS = 3000;

/** 编辑器区域级监听：剪贴板粘贴 / HTML5 拖放图片进入导入管线；Mod-k 请求链接输入 */
function useRichTextDomListener(editor: Editor | null, handleFiles: (files: File[]) => void) {
  useEffect(() => {
    if (!editor) return;
    const listeners = createRichTextDomListeners(editor.view.dom, {
      onFiles: handleFiles,
      onRequestLink: () => requestLinkInput(editor.view.dom),
    });
    return () => listeners.dispose();
  }, [editor, handleFiles]);
}

/** 桌面端 OS 级拖放：仅拖拽悬停在编辑器区域内时导入（shared 门禁，与 Markdown 侧一致） */
function useRichTextDropListener(
  editor: Editor | null,
  importPath: ReturnType<typeof useImportAssetMutation>,
  insertImage: (src: string, alt: string) => void,
  showStatus: (message: string) => void,
  t: ReturnType<typeof useTranslation>["t"]
) {
  useEffect(() => {
    if (!editor) return;
    const gate = watchDragInside(editor.view.dom);
    let unlisten: (() => void) | undefined;
    void onDropPaths((paths) => {
      if (!gate.isInside()) return;
      paths.forEach((path) => {
        importPath.mutate(path, {
          onSuccess: (asset) => {
            insertImage(asset.path, basename(path));
            showStatus(t("note.assetImported", { name: basename(path) }));
          },
          onError: (error) => showStatus(t("note.assetFailed", { message: messageOf(error) })),
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
  }, [editor, importPath, insertImage, showStatus, t]);
}

/** 富文本图片/资产导入：字节写入仓库 assets/ 后以仓库相对路径插入图片 node（P1-4 富文本） */
export function useRichTextAssets(editor: Editor | null) {
  const { t } = useTranslation();
  const importBytes = useImportAssetBytesMutation();
  const importPath = useImportAssetMutation();
  const [status, setStatus] = useState<string | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current); }, []);

  const showStatus = useCallback((message: string) => {
    setStatus(message);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setStatus(null), STATUS_CLEAR_MS);
  }, []);

  const insertImage = useCallback((src: string, alt: string) => {
    if (editor) editor.chain().focus().setImage({ src, alt }).run();
  }, [editor]);

  useRichTextDropListener(editor, importPath, insertImage, showStatus, t);

  const handleFiles = useCallback((files: File[]) => {
    const { images, oversized } = splitImageFiles(files);
    oversized.forEach((file) => {
      showStatus(
        t("note.assetTooLarge", {
          name: file.name,
          limit: Math.round(MAX_IMAGE_BYTES / 1024 / 1024),
        })
      );
    });
    for (const file of images) {
      void file.arrayBuffer().then((buffer) => {
        importBytes.mutate(
          { bytes: new Uint8Array(buffer), fileName: file.name },
          {
            onSuccess: (asset) => { insertImage(asset.path, file.name); showStatus(t("note.assetImported", { name: file.name })); },
            onError: (error) => showStatus(t("note.assetFailed", { message: messageOf(error) })),
          }
        );
      }).catch((error) => showStatus(t("note.assetFailed", { message: messageOf(error) })));
    }
  }, [importBytes, insertImage, showStatus, t]);

  useRichTextDomListener(editor, handleFiles);

  return { handleFiles, status, showStatus };
}
