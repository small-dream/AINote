import { useMemo, useState } from "react";
import { useConvertNoteMutation } from "@/queries/note.queries";
import { detectConversionLosses, type ConversionLoss } from "@/features/richtext/utils/conversionLoss";
import { swapNoteExtension } from "../utils/noteKind";

interface UseNoteConversionOptions {
  notePath: string | null;
  draft: string;
  flush: () => Promise<void>;
  onOpenNote: (path: string) => void;
}

export interface RichTextConvertDialogState {
  open: boolean;
  losses: ConversionLoss[];
  converting: boolean;
}

/** 笔记类型互转编排：确认对话框状态 + 生成目标路径与内容、调 mutation、成功后打开新路径 */
export function useNoteConversion({ notePath, draft, flush, onOpenNote }: UseNoteConversionOptions) {
  const convertMutation = useConvertNoteMutation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const losses = useMemo(() => detectConversionLosses(draft), [draft]);

  const handleConvertNote = (to: string, content: string) => {
    if (!notePath) return;
    convertMutation.mutate(
      { from: notePath, to, content },
      {
        onSuccess: () => {
          onOpenNote(to);
        },
      }
    );
  };

  /** 弹出确认对话框（转换有损且不可逆，先静态列出将丢失的内容） */
  const requestConvertToRichText = () => {
    if (!notePath) return;
    setDialogOpen(true);
  };

  const cancelConvertToRichText = () => setDialogOpen(false);

  /** 对话框确认后执行：先落盘草稿，再把 Markdown 转为 TipTap JSON */
  const confirmConvertToRichText = async () => {
    setDialogOpen(false);
    if (!notePath) return;
    await flush();
    const { markdownToRichTextJson } = await import("@/features/richtext/utils/markdownConversion");
    handleConvertNote(swapNoteExtension(notePath, "richText"), markdownToRichTextJson(draft));
  };

  /** 富文本 → Markdown（可逆，无需确认）：TipTap JSON 序列化为 Markdown 后走同一转换通道 */
  const handleConvertToMarkdown = async () => {
    if (!notePath) return;
    await flush();
    const { richTextJsonToMarkdown } = await import("@/features/richtext/utils/markdownConversion");
    handleConvertNote(swapNoteExtension(notePath, "markdown"), richTextJsonToMarkdown(draft));
  };

  const richTextDialog: RichTextConvertDialogState = {
    open: dialogOpen,
    losses,
    converting: convertMutation.isPending,
  };

  return {
    handleConvertNote,
    richTextDialog,
    requestConvertToRichText,
    cancelConvertToRichText,
    confirmConvertToRichText,
    handleConvertToMarkdown,
  };
}
