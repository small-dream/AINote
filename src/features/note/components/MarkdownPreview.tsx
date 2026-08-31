import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components, type ExtraProps } from "react-markdown";
import type { ComponentType } from "react";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { assetUrl } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";
import {
  decodeWikiHref,
  transformWikiLinks,
  WIKI_PROTOCOL,
} from "@/features/wiki/utils/wiki";
import { slugifyHeading, textContent } from "../utils/preview";
import { useTranslation } from "@/i18n";

interface MarkdownPreviewProps {
  content: string;
  /** 活动仓库绝对路径，用于把仓库相对图片路径解析为本地资产 URL（P1-4） */
  repoPath?: string | null;
  /** 点击 `[[双链]]` 时回调目标名（P1-5） */
  onOpenWiki?: (name: string) => void;
}

/** 为块级元素注入 data-line（Markdown 起始行号），供分栏同步滚动收集锚点 */
const blockComponents: Components = {
  h1: Heading("h1"), h2: Heading("h2"), h3: Heading("h3"), h4: Heading("h4"), h5: Heading("h5"), h6: Heading("h6"),
  p: ({ node, ...props }) => <p data-line={node?.position?.start.line} {...props} />,
  pre: CodeBlock,
  blockquote: ({ node, ...props }) => <blockquote data-line={node?.position?.start.line} {...props} />,
  li: ({ node, ...props }) => <li data-line={node?.position?.start.line} {...props} />,
  tr: ({ node, ...props }) => <tr data-line={node?.position?.start.line} {...props} />,
};

type HeadingProps = ComponentProps<"h1"> & ExtraProps;
type PreProps = ComponentProps<"pre"> & ExtraProps;

function Heading(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"): ComponentType<HeadingProps> {
  return ({ node, children, ...props }: HeadingProps) => {
    const Component = tag;
    return <Component id={slugifyHeading(textContent(children))} data-line={getNodeLine(node)} {...props}>{children}</Component>;
  };
}

function CodeBlock({ node, children, ...props }: PreProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = textContent(children).replace(/\n$/, "");
  const language = getLanguage(children);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="markdown-code-block" data-line={getNodeLine(node)}>
      <div className="markdown-code-toolbar">
        <span>{language ?? t("note.code")}</span>
        <button type="button" onClick={() => void handleCopy()}>{copied ? t("note.copied") : t("note.copyCode")}</button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );
}

function getNodeLine(node: ExtraProps["node"]): number | undefined {
  if (!node || !("position" in node)) return undefined;
  const position = (node as unknown as { position?: { start?: { line?: number } } }).position;
  return position?.start?.line;
}

function getLanguage(children: ReactNode): string | null {
  if (!children || typeof children !== "object" || !("props" in children)) return null;
  const className = (children as { props?: { className?: string } }).props?.className ?? "";
  return className.match(/language-(\S+)/)?.[1] ?? null;
}

/** 渲染单个双链：拦截 wiki: 协议链接，点击回调目标名 */
function WikiLink({ href, children, onOpenWiki }: { href: string; children: React.ReactNode; onOpenWiki?: ((name: string) => void) | undefined }) {
  const name = decodeWikiHref(href);
  return (
    <a
      href="#"
      className="wiki-link"
      onClick={(event) => {
        event.preventDefault();
        onOpenWiki?.(name);
      }}
    >
      {children}
    </a>
  );
}

/** Markdown 渲染预览。react-markdown 默认不渲染原始 HTML（当作文本），天然防 XSS（安全红线）。 */
export function MarkdownPreview({ content, repoPath, onOpenWiki }: MarkdownPreviewProps) {
  const components = useMemo<Components>(() => ({
    ...blockComponents,
    img: ({ node, src, alt, ...props }) => {
      const local = resolveLocalAssetPath(repoPath ?? "", src ?? "");
      return <PreviewImage src={local ? assetUrl(local) : src} alt={alt ?? ""} line={node?.position?.start.line} {...props} />;
    },
    table: ({ node, children, ...props }) => <div className="markdown-table-wrap"><table data-line={node?.position?.start.line} {...props}>{children}</table></div>,
    a: ({ href, children, ...props }) => {
      if (href?.startsWith(WIKI_PROTOCOL)) {
        return <WikiLink href={href} onOpenWiki={onOpenWiki}>{children}</WikiLink>;
      }
      return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
    },
  }), [onOpenWiki, repoPath]);
  return (
    <article className="markdown-body max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
        urlTransform={(url) => (url.startsWith(WIKI_PROTOCOL) ? url : defaultUrlTransform(url))}
      >
        {transformWikiLinks(content)}
      </ReactMarkdown>
    </article>
  );
}

function PreviewImage({ src, alt, line, ...props }: { src: string | undefined; alt: string; line?: number | undefined } & Record<string, unknown>) {
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  return (
    <figure className={`markdown-image markdown-image-${state}`} data-line={line}>
      <img {...props} src={src} alt={alt} loading="lazy" onLoad={() => setState("loaded")} onError={() => setState("error")} />
      {state === "error" ? <figcaption>{t("note.imageLoadFailed")}</figcaption> : null}
    </figure>
  );
}
