import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isExternalHttpUrl, openExternalLink } from "@/platform/open-link";
import { reportToastError } from "@/stores/toast.store";

interface UpdateReleaseNotesProps {
  content: string;
}

/** 外链交给系统浏览器（壳内 target=_blank 不会打开窗口），其余协议保持原生链接。 */
const markdownComponents: Components = {
  a: ({ children, href }) =>
    isExternalHttpUrl(href) ? (
      <a
        href={href}
        rel="noreferrer"
        onClick={(event) => {
          event.preventDefault();
          void openExternalLink(href).catch(reportToastError);
        }}
      >
        {children}
      </a>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ),
};

export function UpdateReleaseNotes({ content }: UpdateReleaseNotesProps) {
  return (
    <div className="markdown-body max-w-none text-sm">
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
        urlTransform={defaultUrlTransform}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
