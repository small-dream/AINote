import { mermaidConfig } from "../../utils/mermaidTheme";

let mermaidModule: typeof import("mermaid")["default"] | null = null;

async function loadMermaid(): Promise<typeof import("mermaid")["default"]> {
  if (mermaidModule) return mermaidModule;
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize(mermaidConfig(null));
  mermaidModule = mermaid;
  return mermaid;
}

let idCounter = 0;

/** 在 container 中异步渲染 Mermaid 图表；按当前阅读主题生成 GitHub 风格配色。 */
export async function renderMermaid(container: HTMLElement, source: string): Promise<void> {
  const mermaid = await loadMermaid();
  mermaid.initialize(mermaidConfig(container));
  const id = `cm-sr-mermaid-${Date.now()}-${++idCounter}`;
  try {
    const { svg } = await mermaid.render(id, source);
    container.innerHTML = svg;
  } catch {
    container.textContent = source;
  }
}
