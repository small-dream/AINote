import { createRoot } from "react-dom/client";
import { CodeBlockControls } from "./components/CodeBlockControls";

interface Options {
  pre: HTMLPreElement;
  getSource: () => string;
  footer?: HTMLElement;
  onLayoutChange?: () => void;
}

/** 为非 React 编辑器只挂载操作区，不把 pre/contentDOM 交给 React。 */
export function mountCodeBlock({ pre, getSource, footer, onLayoutChange }: Options) {
  const shell = document.createElement("div");
  shell.className = "note-code-block";
  const main = document.createElement("div");
  main.className = "note-code-main";
  const content = document.createElement("div");
  content.className = "note-code-content";
  const scrollHost = document.createElement("div");
  scrollHost.className = "note-code-scroll-host";
  scrollHost.dataset.codeControl = "";
  scrollHost.setAttribute("contenteditable", "false");
  const actions = document.createElement("div");
  actions.className = "note-code-controls";
  actions.dataset.codeControl = "";
  actions.contentEditable = "false";
  for (const host of [actions, scrollHost]) {
    host.addEventListener("mousedown", (event) => {
      if ((event.target as Element).closest("button")) event.preventDefault();
      event.stopPropagation();
    });
  }
  pre.classList.add("note-code-pre");
  content.append(pre, scrollHost);
  main.append(content, actions);
  shell.append(main);
  if (footer) shell.append(footer);
  const root = createRoot(actions);
  let destroyed = false;
  queueMicrotask(() => {
    if (!destroyed) root.render(
      <CodeBlockControls pre={pre} scrollHost={scrollHost} getSource={getSource} onLayoutChange={onLayoutChange} />,
    );
  });
  return {
    shell,
    destroy: () => {
      destroyed = true;
      pre.classList.remove("note-code-wrapped");
      queueMicrotask(() => root.unmount());
    },
  };
}
