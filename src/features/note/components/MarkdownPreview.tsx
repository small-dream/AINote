import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components, type ExtraProps } from "react-markdown";
import type { ComponentType } from "react";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { assetUrl } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";
import {
  decodeWikiHref,
  resolveWikiTarget,
  transformWikiLinks,
  WIKI_PROTOCOL,
} from "@/features/wiki/utils/wiki";
import type { NoteWikiDto } from "@/api/types";
import { parseMarkdownDocument, remarkCallouts, remarkRemoveFrontmatter, type CalloutKind } from "../utils/markdownPipeline";
import { slugifyHeading, textContent } from "../utils/preview";
import { useTranslation } from "@/i18n";
import { MarkdownProperties } from "./MarkdownProperties";
import { MermaidBlock } from "./MermaidBlock";

interface MarkdownPreviewProps {
  content: string;
  /** 活动仓库绝对路径，用于把仓库相对图片路径解析为本地资产 URL（P1-4） */
  repoPath?: string | null;
  /** 点击 `[[双链]]` 时回调目标名（P1-5） */
  onOpenWiki?: (name: string) => void;
  /** 当前仓库索引，用于区分已解析与未解析双链。 */
  wikiNotes?: NoteWikiDto[];
}

/** 为块级元素注入 data-line（Markdown 起始行号），供分栏同步滚动收集锚点 */
const blockComponents: Components = {
  p: ({ node, ...props }) => <p data-line={node?.position?.start.line} {...props} />,
  pre: CodeBlock,
  blockquote: CalloutBlockquote,
  li: ({ node, ...props }) => <li data-line={node?.position?.start.line} {...props} />,
  tr: ({ node, ...props }) => <tr data-line={node?.position?.start.line} {...props} />,
};

type HeadingProps = ComponentProps<"h1"> & ExtraProps;
type PreProps = ComponentProps<"pre"> & ExtraProps;

function Heading(tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6", ids: Map<string, number>): ComponentType<HeadingProps> {
  return ({ node, children, ...props }: HeadingProps) => {
    const Component = tag;
    const base = slugifyHeading(textContent(children));
    const count = ids.get(base) ?? 0;
    ids.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return <Component id={id} data-line={getNodeLine(node)} {...props}>{children}</Component>;
  };
}

function CodeBlock({ node, children, ...props }: PreProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = textContent(children).replace(/\n$/, "");
  const language = getLanguage(children);
  if (language?.toLocaleLowerCase() === "mermaid") {
    return <MermaidBlock source={code} line={getNodeLine(node)} />;
  }
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

function CalloutBlockquote({ node, children, ...props }: ComponentProps<"blockquote"> & ExtraProps) {
  const kind = getCalloutKind(node);
  if (!kind) return <blockquote data-line={getNodeLine(node)} {...props}>{children}</blockquote>;
  return <aside className={`markdown-callout markdown-callout-${kind}`} data-callout={kind} data-line={getNodeLine(node)} {...props}>{children}</aside>;
}

const CALLOUT_KINDS = new Set<CalloutKind>(["note", "tip", "important", "warning", "caution", "danger"]);

function getCalloutKind(node: ExtraProps["node"]): CalloutKind | null {
  if (!node || !("properties" in node)) return null;
  const value = (node as { properties?: Record<string, unknown> }).properties?.["data-callout"];
  return typeof value === "string" && CALLOUT_KINDS.has(value as CalloutKind) ? (value as CalloutKind) : null;
}

function getLanguage(children: ReactNode): string | null {
  if (!children || typeof children !== "object" || !("props" in children)) return null;
  const className = (children as { props?: { className?: string } }).props?.className ?? "";
  return className.match(/language-(\S+)/)?.[1] ?? null;
}

/** 渲染单个双链：拦截 wiki: 协议链接，点击回调目标名 */
function WikiLink({ href, children, onOpenWiki, resolved }: { href: string; children: React.ReactNode; onOpenWiki?: ((name: string) => void) | undefined; resolved?: boolean | undefined }) {
  const { t } = useTranslation();
  const name = decodeWikiHref(href);
  const unresolved = resolved === false;
  return (
    <a
      href="#"
      className={`wiki-link${unresolved ? " wiki-link-unresolved" : ""}`}
      aria-label={unresolved ? `${name} · ${t("wiki.notCreated")}` : undefined}
      title={unresolved ? t("wiki.notCreated") : undefined}
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
export function MarkdownPreview({ content, repoPath, onOpenWiki, wikiNotes }: MarkdownPreviewProps) {
  const document = useMemo(() => parseMarkdownDocument(content), [content]);
  const components = useMemo<Components>(() => ({
    ...blockComponents,
    ...createHeadingComponents(),
    img: ({ node, src, alt, ...props }) => {
      const local = resolveLocalAssetPath(repoPath ?? "", src ?? "");
      return <PreviewImage src={local ? assetUrl(local) : src} alt={alt ?? ""} line={node?.position?.start.line} {...props} />;
    },
    table: ({ node, children, ...props }) => <div className="markdown-table-wrap"><table data-line={node?.position?.start.line} {...props}>{children}</table></div>,
      a: ({ href, children, ...props }) => {
      if (href?.startsWith(WIKI_PROTOCOL)) {
        const resolved = wikiNotes ? resolveWikiTarget(wikiNotes, decodeWikiHref(href)) !== null : undefined;
        return <WikiLink href={href} onOpenWiki={onOpenWiki} resolved={resolved}>{children}</WikiLink>;
      }
      return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>;
    },
  }), [onOpenWiki, repoPath, wikiNotes]);
  return (
    <article className="markdown-body max-w-3xl">
      {document.frontmatter.length > 0 ? <MarkdownProperties fields={document.frontmatter} /> : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, [remarkFrontmatter, ["yaml", "toml"]], remarkCallouts, remarkRemoveFrontmatter]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={components}
        urlTransform={(url) => (url.startsWith(WIKI_PROTOCOL) ? url : defaultUrlTransform(url))}
      >
        {transformWikiLinks(content)}
      </ReactMarkdown>
    </article>
  );
}

function createHeadingComponents(): Pick<Components, "h1" | "h2" | "h3" | "h4" | "h5" | "h6"> {
  const ids = new Map<string, number>();
  return { h1: Heading("h1", ids), h2: Heading("h2", ids), h3: Heading("h3", ids), h4: Heading("h4", ids), h5: Heading("h5", ids), h6: Heading("h6", ids) };
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
