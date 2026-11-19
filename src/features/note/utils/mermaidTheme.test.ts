import { describe, expect, it } from "vitest";
import { mermaidConfig } from "./mermaidTheme";

function withSurface(theme: Record<string, string>): HTMLElement {
  const host = document.createElement("div");
  host.className = "note-theme-surface";
  for (const [name, value] of Object.entries(theme)) host.style.setProperty(name, value);
  const child = document.createElement("div");
  host.append(child);
  document.body.append(host);
  return child;
}

describe("mermaidConfig GitHub 风格", () => {
  it("没有主题上下文时使用 Mermaid 默认亮色主题且画布透明", () => {
    const config = mermaidConfig(null);
    expect(config.theme).toBe("default");
    expect(config.themeVariables?.background).toBe("transparent");
    expect(config.themeVariables?.edgeLabelBackground).toBe("#ffffff");
    expect(config.themeCSS).toContain("drop-shadow(1px 2px 2px rgba(185, 185, 185, 1))");
    expect(config.themeCSS).not.toContain("rx:");
  });

  it("亮色阅读主题沿用 GitHub 默认配色，边标签贴合纸张底色", () => {
    const child = withSurface({
      "--note-bg": "#fbf7ef",
      "--note-ink": "#3f3528",
      "--note-border": "#ddcdb7",
      "--note-body-font-sans": "Georgia, serif",
    });

    const config = mermaidConfig(child);
    expect(config.theme).toBe("default");
    expect(config.themeVariables?.background).toBe("transparent");
    expect(config.themeVariables?.edgeLabelBackground).toBe("#fbf7ef");
    expect(config.themeVariables?.fontFamily).toBe("Georgia, serif");
    expect(config.themeVariables?.primaryColor).toBeUndefined();

    child.parentElement?.remove();
  });

  it("暗色阅读主题切换到 Mermaid dark 主题并使用深色阴影", () => {
    const child = withSurface({
      "--note-bg": "#111827",
      "--note-ink": "#e5edf8",
      "--note-border": "#40587c",
    });

    const config = mermaidConfig(child);
    expect(config.theme).toBe("dark");
    expect(config.themeVariables?.background).toBe("transparent");
    expect(config.themeVariables?.edgeLabelBackground).toBe("#111827");
    expect(config.themeCSS).toContain("rgba(0, 0, 0, 0.45)");

    child.parentElement?.remove();
  });

  it("透明背景不会误判为暗色主题", () => {
    const child = withSurface({ "--note-bg": "rgba(0, 0, 0, 0)" });

    const config = mermaidConfig(child);
    expect(config.theme).toBe("default");
    expect(config.themeVariables?.edgeLabelBackground).toBe("#ffffff");

    child.parentElement?.remove();
  });
});
