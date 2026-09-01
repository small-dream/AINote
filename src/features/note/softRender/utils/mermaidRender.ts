let mermaidModule: typeof import("mermaid")["default"] | null = null;

async function loadMermaid(): Promise<typeof import("mermaid")["default"]> {
  if (mermaidModule) return mermaidModule;
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" });
  mermaidModule = mermaid;
  return mermaid;
}

let idCounter = 0;

/** 在 container 中异步渲染 Mermaid 图表；背景偏暗时使用暗色主题。 */
export async function renderMermaid(container: HTMLElement, source: string): Promise<void> {
  const mermaid = await loadMermaid();
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: darkBackground(container) ? "dark" : "base" });
  const id = `cm-sr-mermaid-${Date.now()}-${++idCounter}`;
  try {
    const { svg } = await mermaid.render(id, source);
    container.innerHTML = svg;
  } catch {
    container.textContent = source;
  }
}

function darkBackground(container: HTMLElement): boolean {
  const surface = container.closest(".note-theme-surface");
  const bg = getComputedStyle(surface ?? container).backgroundColor;
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
  if (!match) return false;
  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 128;
}
