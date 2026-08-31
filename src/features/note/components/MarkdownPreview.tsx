import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "@/api";
import { resolveLocalAssetPath } from "@/features/asset/utils/asset";
import {
  decodeWikiHref,
  transformWikiLinks,
  WIKI_PROTOCOL,
} from "@/features/wiki/utils/wiki";

interface MarkdownPreviewProps {
  content: string;
  /** 活动仓库绝对路径，用于把仓库相对图片路径解析为本地资产 URL（P1-4） */
  repoPath?: string | null;
  /** 点击 `[[双链]]` 时回调目标名（P1-5） */
  onOpenWiki?: (name: string) => void;
}

/** 为块级元素注入 data-line（Markdown 起始行号），供分栏同步滚动收集锚点 */
const blockComponents: Components = {
  h1: ({ node, ...props }) => <h1 data-line={node?.position?.start.line} {...props} />,
  h2: ({ node, ...props }) => <h2 data-line={node?.position?.start.line} {...props} />,
  h3: ({ node, ...props }) => <h3 data-line={node?.position?.start.line} {...props} />,
  h4: ({ node, ...props }) => <h4 data-line={node?.position?.start.line} {...props} />,
  h5: ({ node, ...props }) => <h5 data-line={node?.position?.start.line} {...props} />,
  h6: ({ node, ...props }) => <h6 data-line={node?.position?.start.line} {...props} />,
  p: ({ node, ...props }) => <p data-line={node?.position?.start.line} {...props} />,
  pre: ({ node, ...props }) => <pre data-line={node?.position?.start.line} {...props} />,
  blockquote: ({ node, ...props }) => <blockquote data-line={node?.position?.start.line} {...props} />,
  li: ({ node, ...props }) => <li data-line={node?.position?.start.line} {...props} />,
  tr: ({ node, ...props }) => <tr data-line={node?.position?.start.line} {...props} />,
};

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
  const components: Components = {
    ...blockComponents,
    img: ({ node, src, alt, ...props }) => {
      const local = resolveLocalAssetPath(repoPath ?? "", src ?? "");
      return (
        <img
          {...props}
          src={local ? assetUrl(local) : src}
          alt={alt ?? ""}
          data-line={node?.position?.start.line}
        />
      );
    },
    a: ({ href, children, ...props }) => {
      if (href?.startsWith(WIKI_PROTOCOL)) {
        return <WikiLink href={href} onOpenWiki={onOpenWiki}>{children}</WikiLink>;
      }
      return <a href={href} {...props}>{children}</a>;
    },
  };
  return (
    <article className="markdown-body max-w-3xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url) => (url.startsWith(WIKI_PROTOCOL) ? url : defaultUrlTransform(url))}
      >
        {transformWikiLinks(content)}
      </ReactMarkdown>
    </article>
  );
}
