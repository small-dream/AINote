import type { TranslationKey } from "@/i18n/messages";

/** 字符级样式的四组取值（白名单枚举）。
 * 取值收敛理由、CSP 约束与对比度实测见 docs/RICHTEXT_FORMATTING_PLAN.md §3。 */
export type TextStyleKind = "font" | "size" | "color" | "mark";

export const FONT_VALUES = ["sans", "serif", "mono"] as const;
export const SIZE_VALUES = ["sm", "base", "lg", "xl"] as const;
export const COLOR_VALUES = ["accent", "success", "warning", "danger", "muted"] as const;
export const MARK_VALUES = ["yellow", "green", "blue", "pink", "gray"] as const;

export type TextStyleValue = (typeof FONT_VALUES)[number] | (typeof SIZE_VALUES)[number] | (typeof COLOR_VALUES)[number] | (typeof MARK_VALUES)[number];

/** 文字色与高亮底由主题 token 派生的比例：与 rich-text.css 的 color-mix 取值、对比度单测共用同一常量。
 * 比例调高会击穿 WCAG AA（实测 0.85 时 solar/成功 = 4.47），改动前必须重跑对比度单测。 */
export const TEXT_COLOR_MIX = 0.78;
export const MARK_ALPHA = 0.3;

export interface TextStyleSpec {
  /** TipTap mark 名，与 extensions/formatMarks.ts 一一对应 */
  markName: string;
  /** class 前缀：`rt-font-` / `rt-size-` / `rt-fg-` / `rt-mark-` */
  classPrefix: string;
  /** 渲染元素：高亮用语义化的 <mark>，其余为 <span> */
  tag: "span" | "mark";
  /** 面板控件形态：字体 / 字号用文字档位按钮，颜色 / 高亮用色板 */
  control: "option" | "swatch";
  values: readonly string[];
  /** 默认档：等于该档时清除 mark，既不写 attr 也不出 class（避免 JSON 噪音） */
  defaultValue: string | null;
  labelKey: TranslationKey;
  optionLabelKeys: Readonly<Record<string, TranslationKey>>;
  /** 「重置 / 清除」动作文案 */
  clearLabelKey: TranslationKey;
}

/** 四组样式的策略表：面板渲染、命令执行、class 映射与测试断言共用同一份定义。 */
export const TEXT_STYLE_SPECS: Readonly<Record<TextStyleKind, TextStyleSpec>> = {
  font: {
    markName: "fontStyle",
    classPrefix: "rt-font-",
    tag: "span",
    control: "option",
    values: FONT_VALUES,
    defaultValue: null,
    labelKey: "richtext.fontLabel",
    clearLabelKey: "richtext.fontClear",
    optionLabelKeys: { sans: "richtext.fontSans", serif: "richtext.fontSerif", mono: "richtext.fontMono" },
  },
  size: {
    markName: "sizeStyle",
    classPrefix: "rt-size-",
    tag: "span",
    control: "option",
    values: SIZE_VALUES,
    defaultValue: "base",
    labelKey: "richtext.sizeLabel",
    clearLabelKey: "richtext.sizeBase",
    optionLabelKeys: { sm: "richtext.sizeSm", base: "richtext.sizeBase", lg: "richtext.sizeLg", xl: "richtext.sizeXl" },
  },
  color: {
    markName: "fgStyle",
    classPrefix: "rt-fg-",
    tag: "span",
    control: "swatch",
    values: COLOR_VALUES,
    defaultValue: null,
    labelKey: "richtext.colorLabel",
    clearLabelKey: "richtext.colorClear",
    optionLabelKeys: { accent: "richtext.colorAccent", success: "richtext.colorSuccess", warning: "richtext.colorWarning", danger: "richtext.colorDanger", muted: "richtext.colorMuted" },
  },
  mark: {
    markName: "markStyle",
    classPrefix: "rt-mark-",
    tag: "mark",
    control: "swatch",
    values: MARK_VALUES,
    defaultValue: null,
    labelKey: "richtext.markLabel",
    clearLabelKey: "richtext.markClear",
    optionLabelKeys: { yellow: "richtext.markYellow", green: "richtext.markGreen", blue: "richtext.markBlue", pink: "richtext.markPink", gray: "richtext.markGray" },
  },
};

/** 面板与气泡菜单的展示顺序 */
export const TEXT_STYLE_KINDS: readonly TextStyleKind[] = ["font", "size", "color", "mark"];

/** 白名单校验：非枚举值一律 null（脏数据与旧版本残留的兜底）。 */
export function normalizeTextStyle(kind: TextStyleKind, raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return TEXT_STYLE_SPECS[kind].values.includes(raw) ? raw : null;
}

/** 枚举值 → 渲染 class；默认档与非法值返回 null（不产出 class）。 */
export function textStyleClass(kind: TextStyleKind, raw: unknown): string | null {
  const value = normalizeTextStyle(kind, raw);
  if (!value) return null;
  const spec = TEXT_STYLE_SPECS[kind];
  return value === spec.defaultValue ? null : `${spec.classPrefix}${value}`;
}

/** DOM class → 枚举值（parseHTML 用）。只认自有前缀，外部粘贴的 `span[style]` 不会被识别。 */
export function readTextStyleClass(kind: TextStyleKind, className: unknown): string | null {
  if (typeof className !== "string") return null;
  const spec = TEXT_STYLE_SPECS[kind];
  for (const token of className.split(/\s+/)) {
    if (!token.startsWith(spec.classPrefix)) continue;
    const value = normalizeTextStyle(kind, token.slice(spec.classPrefix.length));
    if (value) return value;
  }
  return null;
}

/** 面板回显用的生效档位：未设样式时回落到该组默认档（字号回落「正文」）。 */
export function effectiveTextStyle(kind: TextStyleKind, value: string | null): string | null {
  return value ?? TEXT_STYLE_SPECS[kind].defaultValue;
}

/** 档位显示名；未登记的档位返回 null，由调用方回退到原始值。 */
export function optionLabelKey(kind: TextStyleKind, value: string): TranslationKey | null {
  return TEXT_STYLE_SPECS[kind].optionLabelKeys[value] ?? null;
}
