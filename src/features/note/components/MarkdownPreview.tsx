import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

/** Markdown 渲染预览。react-markdown 默认不渲染原始 HTML（当作文本），天然防 XSS（安全红线）。 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <article className="markdown-body max-w-3xl">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
