import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useImportAssetBytesMutation } from "@/queries/asset.queries";
import { useTranslation } from "@/i18n";

const STATUS_CLEAR_MS = 3000;

/** 富文本图片/资产导入：字节写入仓库 assets/ 后以仓库相对路径插入图片 node（P1-4 富文本） */
export function useRichTextAssets(editor: Editor | null) {
  const { t } = useTranslation();
  const importBytes = useImportAssetBytesMutation();
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

  const handleFiles = useCallback((files: File[]) => {
    for (const file of files) {
      void file.arrayBuffer().then((buffer) => {
        importBytes.mutate(
          { bytes: new Uint8Array(buffer), fileName: file.name },
          {
            onSuccess: (asset) => { insertImage(asset.path, file.name); showStatus(t("note.assetImported", { name: file.name })); },
            onError: () => showStatus(t("note.assetFailed", { message: "" })),
          }
        );
      });
    }
  }, [importBytes, insertImage, showStatus, t]);

  return { handleFiles, status };
}
