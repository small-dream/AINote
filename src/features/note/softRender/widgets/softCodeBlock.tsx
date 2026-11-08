import { useId, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { CodeBlockToolbar } from "@/features/code-block/components/CodeBlockToolbar";
import { CodeScrollbar } from "@/features/code-block/components/CodeScrollbar";
import { useCodeBlockPresentation } from "@/features/code-block/hooks/useCodeBlockPresentation";
import { useTranslation } from "@/i18n";

interface MountOptions {
  pre: HTMLPreElement;
  source: string;
  language: string;
  onLanguageChange: (language: string) => void;
  onEnterEdit: () => void;
  onLayoutChange?: (() => void) | undefined;
}

interface HeaderProps extends Omit<MountOptions, "pre" | "onEnterEdit"> {
  pre: HTMLPreElement;
  scrollHost: HTMLElement;
  onEnterEdit: () => void;
}

/** 渲染态软代码块：React 只管理顶栏与滚动条，pre 内容仍由宿主生成。 */
export function mountSoftCodeBlock(options: MountOptions) {
  const shell = document.createElement("div");
  shell.className = "note-code-block";
  const header = document.createElement("div");
  header.className = "cm-sr-codeblock-header";
  header.dataset.codeControl = "";
  header.setAttribute("contenteditable", "false");
  const content = document.createElement("div");
  content.className = "note-code-content";
  const scrollHost = document.createElement("div");
  scrollHost.className = "note-code-scroll-host";
  scrollHost.dataset.codeControl = "";
  scrollHost.setAttribute("contenteditable", "false");
  options.pre.classList.add("note-code-pre");
  content.append(options.pre, scrollHost);
  shell.append(header, content);
  const enterOnBackground = (event: MouseEvent) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target.closest("button, select, input, textarea, a, label, [role='scrollbar']")) return;
    event.preventDefault();
    event.stopPropagation();
    options.onEnterEdit();
  };
  header.addEventListener("mousedown", enterOnBackground, true);
  scrollHost.addEventListener("mousedown", enterOnBackground, true);
  const root = createRoot(header);
  let destroyed = false;
  queueMicrotask(() => {
    if (!destroyed) root.render(<SoftCodeBlockHeader {...options} scrollHost={scrollHost} />);
  });
  return {
    shell,
    destroy: () => {
      destroyed = true;
      header.removeEventListener("mousedown", enterOnBackground, true);
      scrollHost.removeEventListener("mousedown", enterOnBackground, true);
      queueMicrotask(() => root.unmount());
    },
  };
}

function SoftCodeBlockHeader({ pre, scrollHost, source, language, onLanguageChange, onEnterEdit, onLayoutChange }: HeaderProps) {
  const { t } = useTranslation();
  const id = useId();
  const presentation = useCodeBlockPresentation(pre, onLayoutChange);
  const showScrollbar = presentation.visible && !presentation.wrapped;
  const scrollbarId = pre.id || id;
  useLayoutEffect(() => {
    if (!pre.id) pre.setAttribute("id", id);
  }, [pre, id]);
  useLayoutEffect(() => {
    scrollHost.classList.toggle("is-empty", !showScrollbar);
  }, [scrollHost, showScrollbar]);
  return (
    <>
      <CodeBlockToolbar language={language} source={source} toggleKind="expand"
        onLanguageChange={onLanguageChange} onToggle={onEnterEdit}
        wrap={{ wrapped: presentation.wrapped, onToggle: presentation.toggleWrap }} />
      {showScrollbar ? createPortal(
        <CodeScrollbar {...presentation} preRef={presentation.preRef} preId={scrollbarId} label={t("note.codeBlock")} />,
        scrollHost,
      ) : null}
    </>
  );
}
