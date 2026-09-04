import { useConvertNoteMutation } from "@/queries/note.queries";
import { syncApi } from "@/api";
import { reportToastError } from "@/stores/toast.store";
import { markdownToRichTextJson } from "@/features/richtext/utils/markdownConversion";
import { swapNoteExtension } from "../utils/noteKind";

interface UseNoteConversionOptions {
  notePath: string | null;
  draft: string;
  flush: () => Promise<void>;
  onOpenNote: (path: string) => void;
}

/** 笔记类型互转编排：生成目标路径与内容、调 mutation、成功后提交 Git 并打开新路径 */
export function useNoteConversion({ notePath, draft, flush, onOpenNote }: UseNoteConversionOptions) {
  const convertMutation = useConvertNoteMutation();

  const handleConvertNote = (to: string, content: string) => {
    if (!notePath) return;
    convertMutation.mutate(
      { from: notePath, to, content },
      {
        onSuccess: () => {
          void syncApi.commit(`note: convert ${to}`).catch(reportToastError).finally(() => onOpenNote(to));
        },
      }
    );
  };

  const handleConvertToRichText = async () => {
    if (!notePath) return;
    await flush();
    handleConvertNote(swapNoteExtension(notePath, "richText"), markdownToRichTextJson(draft));
  };

  return { handleConvertNote, handleConvertToRichText };
}
