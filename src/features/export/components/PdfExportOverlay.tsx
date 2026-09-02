import { useMemo } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import type { NoteKind } from "@/api/types";
import { printPage } from "@/api";
import { MarkdownPreview } from "@/features/note/components/MarkdownPreview";
import { richTextJsonToHtml } from "../utils/richTextHtml";
import { useTranslation } from "@/i18n";

interface PdfExportOverlayProps {
  open: boolean;
  /** 导出文档名（打印对话框默认文件名） */
  title: string;
  kind: NoteKind;
  /** Markdown 原文或 TipTap JSON */
  content: string;
  /** 活动仓库绝对路径：用于解析仓库相对图片 */
  repoPath: string | null;
  onClose: () => void;
}

/** 导出 PDF：全屏浅色打印预览 + 系统打印对话框（可在其中选择“存储为 PDF”）。 */
export function PdfExportOverlay({ open, title, kind, content, repoPath, onClose }: PdfExportOverlayProps) {
  if (!open) return null;
  return createPortal(
    <PdfExportScreen title={title} kind={kind} content={content} repoPath={repoPath} onClose={onClose} />,
    document.body,
  );
}

function PdfExportScreen({ title, kind, content, repoPath, onClose }: Omit<PdfExportOverlayProps, "open">) {
  const { t } = useTranslation();
  return (
    <div className="pdf-export-root" role="dialog" aria-modal="true" aria-label={t("note.exportPdf")}>
      <div data-tauri-drag-region className="pdf-export-drag-space h-11 shrink-0" aria-hidden="true" />
      <header className="pdf-export-toolbar">
        <div className="pdf-export-actions">
          <Button type="button" variant="ghost" onClick={onClose}><ArrowLeft size={15} />{t("export.back")}</Button>
        </div>
        <span className="pdf-export-title" title={title}>{title}</span>
        <div className="pdf-export-actions">
          <span className="pdf-export-hint">{t("export.pdfHint")}</span>
          <Button type="button" variant="primary" onClick={() => void handlePrint(title)}><Printer size={15} />{t("export.print")}</Button>
        </div>
      </header>
      <PdfDocument kind={kind} content={content} repoPath={repoPath} />
    </div>
  );
}

function PdfDocument({ kind, content, repoPath }: Pick<PdfExportOverlayProps, "kind" | "content" | "repoPath">) {
  if (kind === "richText") return <RichTextDocument content={content} repoPath={repoPath} />;
  return (
    <div className="pdf-export-scroll">
      <div className="markdown-body pdf-export-page">
        <MarkdownPreview content={content} repoPath={repoPath} />
      </div>
    </div>
  );
}

function RichTextDocument({ content, repoPath }: { content: string; repoPath: string | null }) {
  const html = useMemo(() => richTextJsonToHtml(content, repoPath), [content, repoPath]);
  return (
    <div className="pdf-export-scroll rich-text-editor">
      <div className="rich-text-scroll pdf-export-page">
        <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

async function handlePrint(title: string): Promise<void> {
  const previous = document.title;
  document.title = title;
  try {
    try {
      await printPage();
    } catch {
      // 极少数 WebView 无原生打印入口时回退到浏览器打印
      window.print();
    }
  } finally {
    document.title = previous;
  }
}
