import type { MermaidConfig } from "mermaid";

const LIGHT_PAGE = "#ffffff";
const DARK_PAGE = "#0d1117";
const LIGHT_SHADOW = "drop-shadow(1px 2px 2px rgba(185, 185, 185, 1))";
const DARK_SHADOW = "drop-shadow(1px 2px 2px rgba(0, 0, 0, 0.45))";

interface SurfaceTokens {
  canvas: string;
  fontFamily: string;
}

/**
 * 复刻 GitHub 的 Mermaid 渲染：default/dark 官方主题 + 透明画布。
 * GitHub 的亮色节点是 #ECECFF 填充、#9370DB 边框、#333 文字，方角并带轻微阴影。
 */
export function mermaidConfig(container: HTMLElement | null): MermaidConfig {
  const { canvas, fontFamily } = readSurfaceTokens(container);
  const dark = isDarkColor(canvas) ?? false;
  const page = resolvePage(canvas, dark);
  const shadow = dark ? DARK_SHADOW : LIGHT_SHADOW;

  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
    themeVariables: {
      background: "transparent",
      edgeLabelBackground: page,
      ...(fontFamily ? { fontFamily } : {}),
    },
    themeCSS: [
      ".node rect.basic, .node rect.label-container, .node polygon, .node circle, .node ellipse, .node path {",
      `  filter: ${shadow};`,
      "}",
    ].join("\n"),
  };
}

function readSurfaceTokens(container: HTMLElement | null): SurfaceTokens {
  const surface = container?.closest<HTMLElement>(".note-theme-surface") ?? container;
  if (!surface) return { canvas: "", fontFamily: "" };
  const style = getComputedStyle(surface);
  return {
    canvas: style.getPropertyValue("--note-bg").trim() || style.backgroundColor || "",
    fontFamily: style.getPropertyValue("--note-body-font-sans").replace(/\s+/g, " ").trim(),
  };
}

function resolvePage(canvas: string, dark: boolean): string {
  if (canvas && isOpaque(canvas)) return canvas;
  return dark ? DARK_PAGE : LIGHT_PAGE;
}

/** 只有不透明背景才能可靠判断明暗；透明容器按亮色处理。 */
function isOpaque(color: string): boolean {
  return parseColor(color)?.alpha !== 0;
}

function isDarkColor(color: string): boolean | null {
  const rgb = parseColor(color);
  if (!rgb || rgb.alpha === 0) return null;
  const [red, green, blue] = rgb.rgb;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 128;
}

interface RgbaColor {
  rgb: [number, number, number];
  alpha: number;
}

function parseColor(color: string): RgbaColor | null {
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color.trim());
  if (hex) {
    const value = hex[1] ?? "";
    const expanded =
      value.length === 3 || value.length === 4
        ? value.split("").map((part) => part + part).join("")
        : value;
    if (expanded.length !== 6 && expanded.length !== 8) return null;
    const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
    return {
      rgb: [
        Number.parseInt(expanded.slice(0, 2), 16),
        Number.parseInt(expanded.slice(2, 4), 16),
        Number.parseInt(expanded.slice(4, 6), 16),
      ],
      alpha,
    };
  }
  const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(
    color.trim(),
  );
  if (!rgba) return null;
  return {
    rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
    alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
  };
}
