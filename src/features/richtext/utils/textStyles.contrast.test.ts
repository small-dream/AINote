import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARK_ALPHA, TEXT_COLOR_MIX, TEXT_STYLE_SPECS } from "./textStyles";

/** 字符样式的对比度护栏（docs/CODING_STANDARDS.md §3 / docs/RICHTEXT_FORMATTING_PLAN.md §3.3）。
 * 断言对象是 src/styles/*.css 的真实取值，而不是组件里的常量——改主题 token 或调混合比例
 * 都会让本用例失败，避免「只在某套主题下文字看不清」这类问题溜进发布版。 */

const ROOT = path.resolve(import.meta.dirname, "../../../..");

function readCss(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

/** 取出选择器块内的自定义属性（只保留 --note-*，忽略字体栈等无关长值）。 */
function customProps(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `未找到选择器 ${selector}`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("}", start);
  const block = css.slice(start, end);
  const props: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) props[name] = value.trim();
  }
  return props;
}

const themeCss = readCss("src/styles/markdown-themes.css");
const tokenCss = readCss("src/styles/tokens.css");
const tokenRoot = customProps(tokenCss, ":root");
const noteRoot = customProps(themeCss, ":root");
/** classic 主题由 :root 承载（体量最大的一套） */
const classicTheme = { ...tokenRoot, ...noteRoot };

/** 逐主题解析 token，变量引用（如 `--note-ink: var(--text-primary)`）穿透到具体色值。 */
function resolveTheme(theme: string): Record<string, string> {
  const raw = theme === "classic" ? classicTheme : customProps(themeCss, `[data-note-theme="${theme}"]`);
  const resolved: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    const reference = /^var\((--[\w-]+)\)$/.exec(value);
    resolved[name] = reference?.[1] ? (tokenRoot[reference[1]] ?? noteRoot[reference[1]] ?? value) : value;
  }
  return resolved;
}

const THEMES = ["classic", ...Array.from(themeCss.matchAll(/\[data-note-theme="(\w+)"\]/g), (match) => match[1] ?? "")];

/** 颜色档位 → 提供底色的语义 token；与 rich-text.css 的 color-mix 声明一一对应。 */
const COLOR_TOKENS: Readonly<Record<string, string>> = {
  accent: "--note-accent",
  success: "--note-success",
  warning: "--note-warning",
  danger: "--note-danger",
  muted: "--note-secondary",
};

/** 高亮档位 → 语义 token（高亮底 = 该色 30% 叠加在正文底色上）。
 * 档位名描述颜色观感，token 取自现有语义色，与 rich-text.css 的声明一一对应。 */
const MARK_TOKENS: Readonly<Record<string, string>> = {
  yellow: "--note-warning",
  green: "--note-success",
  blue: "--note-accent",
  pink: "--note-danger",
  gray: "--note-secondary",
};

function parseHex(value: string): [number, number, number] {
  const hex = value.trim().replace(/^#/, "");
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(hex)) throw new Error(`非十六进制颜色：${value}`);
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** oklab 的 `color-mix(in oklab, A p%, B)` 与 sRGB 分量加权不等价，但两者在本组取值上
 * 差异远小于 0.1 的余量（实测 oklab 最低 4.87 / sRGB 4.83），因此这里按 sRGB 加权推算，
 * 并把阈值卡在 4.5 而不是「实测最低值」，避免用例对实现细节过度敏感。 */
function mix(base: [number, number, number], top: [number, number, number], ratio: number): [number, number, number] {
  return base.map((value, index) => ratio * (top[index] ?? 0) + (1 - ratio) * value) as [number, number, number];
}

function tokenColor(theme: Record<string, string>, name: string): [number, number, number] {
  const value = theme[name];
  if (!name) throw new Error("token 名为空：调用方未登记语义 token");
  if (!value) throw new Error(`主题缺少 ${name}`);
  return parseHex(value);
}

/** 取档位对应的语义 token 名；未登记直接失败，避免静默跳过一档。 */
function tokenName(map: Readonly<Record<string, string>>, value: string): string {
  const name = map[value];
  if (!name) throw new Error(`档位 ${value} 未登记语义 token`);
  return name;
}

const AA_MIN = 4.5;

/** rich-text.css 里的派生声明：`<prefix><档位> { color|background-color: color-mix(in oklab, var(--note-x) N%, ...) }`。
 * 断言「样式表实际用的 token 与比例」符合本用例的推导，避免 CSS 与测试各说各话。 */
function declaredStyleRules(css: string, property: "color" | "background-color"): Map<string, { token: string; percent: number }> {
  const rules = new Map<string, { token: string; percent: number }>();
  const pattern = new RegExp(`\\.(rt-(?:fg|mark)-[\\w-]+)\\s*\\{[^}]*${property}:\\s*color-mix\\(in oklab,\\s*var\\((--[\\w-]+)\\)\\s*([\\d.]+)%`, "g");
  for (const [, className, token, percent] of css.matchAll(pattern)) {
    if (className && token && percent) rules.set(className, { token, percent: Number(percent) / 100 });
  }
  return rules;
}

const richTextCss = readCss("src/features/richtext/rich-text.css");

describe("rich-text.css 派生声明", () => {
  it("文字色 class 使用的 token 与比例和推导一致", () => {
    const declared = declaredStyleRules(richTextCss, "color");
    for (const value of TEXT_STYLE_SPECS.color.values) {
      const rule = declared.get(`rt-fg-${value}`);
      expect(rule, `缺少 .rt-fg-${value} 的 color-mix 声明`).toBeTruthy();
      expect(rule?.token).toBe(COLOR_TOKENS[value]);
      expect(rule?.percent).toBeCloseTo(TEXT_COLOR_MIX, 4);
    }
  });

  it("高亮 class 使用的 token 与比例和推导一致", () => {
    const declared = declaredStyleRules(richTextCss, "background-color");
    for (const value of TEXT_STYLE_SPECS.mark.values) {
      const rule = declared.get(`rt-mark-${value}`);
      expect(rule, `缺少 .rt-mark-${value} 的 color-mix 声明`).toBeTruthy();
      expect(rule?.token).toBe(MARK_TOKENS[value]);
      expect(rule?.percent).toBeCloseTo(MARK_ALPHA, 4);
    }
  });
});

describe("字符样式调色板", () => {
  it("覆盖 8 套阅读主题（新增主题时必须补齐验证）", () => {
    expect(THEMES).toHaveLength(8);
    expect(new Set(THEMES).size).toBe(8);
  });

  it("颜色与高亮的档位都能映射到语义 token", () => {
    for (const kind of ["color", "mark"] as const) {
      const spec = TEXT_STYLE_SPECS[kind];
      const tokens = kind === "color" ? COLOR_TOKENS : MARK_TOKENS;
      for (const value of spec.values) {
        expect(tokens[value], `${kind}.${value} 未登记语义 token`).toBeTruthy();
      }
    }
  });

  it("5 档文字色在每套主题下都满足 WCAG AA（≥4.5:1）", () => {
    const failures: string[] = [];
    const lowest: { theme: string; value: string; ratio: number } = { theme: "", value: "", ratio: Number.POSITIVE_INFINITY };
    for (const themeName of THEMES) {
      const theme = resolveTheme(themeName);
      const background = tokenColor(theme, "--note-bg");
      const ink = tokenColor(theme, "--note-ink");
      for (const value of TEXT_STYLE_SPECS.color.values) {
        // 与 rich-text.css 一致：色值 = 语义色 TEXT_COLOR_MIX + 正文色（1 - TEXT_COLOR_MIX）
        const foreground = mix(ink, tokenColor(theme, tokenName(COLOR_TOKENS, value)), TEXT_COLOR_MIX);
        const ratio = contrast(foreground, background);
        if (ratio < AA_MIN) failures.push(`${themeName}/${value}=${ratio.toFixed(2)}`);
        if (ratio < lowest.ratio) Object.assign(lowest, { theme: themeName, value, ratio });
      }
    }
    expect(failures, `以下组合低于 ${AA_MIN}:1（不要把混合比例调高）`).toEqual([]);
    // 实测基线：solar/成功 ≈ 4.83，低于该值说明有主题或比例被改动，需要重新走查观感与对比度
    expect(lowest.ratio).toBeGreaterThan(4.7);
  });

  it("5 档高亮在每套主题下文字仍满足 WCAG AA（≥4.5:1）", () => {
    const failures: string[] = [];
    let lowestRatio = Number.POSITIVE_INFINITY;
    for (const themeName of THEMES) {
      const theme = resolveTheme(themeName);
      const background = tokenColor(theme, "--note-bg");
      const ink = tokenColor(theme, "--note-ink");
      for (const value of TEXT_STYLE_SPECS.mark.values) {
        const marker = mix(background, tokenColor(theme, tokenName(MARK_TOKENS, value)), MARK_ALPHA);
        const ratio = contrast(ink, marker);
        if (ratio < AA_MIN) failures.push(`${themeName}/${value}=${ratio.toFixed(2)}`);
        lowestRatio = Math.min(lowestRatio, ratio);
      }
    }
    expect(failures, `高亮叠加后文字对比度不足（不要调高 MARK_ALPHA）`).toEqual([]);
    expect(lowestRatio).toBeGreaterThan(6);
  });
});
