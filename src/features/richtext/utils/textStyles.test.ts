import { describe, expect, it } from "vitest";
import { TEXT_STYLE_SPECS, effectiveTextStyle, normalizeTextStyle, optionLabelKey, readTextStyleClass, textStyleClass } from "./textStyles";

describe("normalizeTextStyle", () => {
  it("只接受登记的档位", () => {
    expect(normalizeTextStyle("color", "danger")).toBe("danger");
    expect(normalizeTextStyle("size", "xl")).toBe("xl");
  });

  it("非法值与非字符串一律回退 null", () => {
    expect(normalizeTextStyle("color", "purple")).toBeNull();
    expect(normalizeTextStyle("size", "99px")).toBeNull();
    expect(normalizeTextStyle("mark", "#ffff00")).toBeNull();
    expect(normalizeTextStyle("font", 12)).toBeNull();
    expect(normalizeTextStyle("font", null)).toBeNull();
  });
});

describe("textStyleClass", () => {
  it("枚举值映射为带前缀的 class", () => {
    expect(textStyleClass("font", "mono")).toBe("rt-font-mono");
    expect(textStyleClass("color", "accent")).toBe("rt-fg-accent");
    expect(textStyleClass("mark", "yellow")).toBe("rt-mark-yellow");
  });

  it("默认档与非法值不产出 class（避免 JSON 与 DOM 噪音）", () => {
    expect(textStyleClass("size", "base")).toBeNull();
    expect(textStyleClass("size", "bogus")).toBeNull();
  });

  it("class 前缀与取值表一一对应", () => {
    for (const [kind, spec] of Object.entries(TEXT_STYLE_SPECS)) {
      for (const value of spec.values) {
        const className = textStyleClass(kind as keyof typeof TEXT_STYLE_SPECS, value);
        if (value === spec.defaultValue) continue;
        expect(className).toBe(`${spec.classPrefix}${value}`);
      }
    }
  });
});

describe("readTextStyleClass", () => {
  it("从 class 串中还原档位", () => {
    expect(readTextStyleClass("color", "rt-fg-danger other")).toBe("danger");
    expect(readTextStyleClass("mark", "rt-mark-blue")).toBe("blue");
  });

  it("无视外部粘贴带来的 style 与无关 class（只认自有前缀）", () => {
    expect(readTextStyleClass("color", "text-red-500")).toBeNull();
    expect(readTextStyleClass("size", "text-[13px]")).toBeNull();
    expect(readTextStyleClass("font", "ProseMirror")).toBeNull();
    expect(readTextStyleClass("color", undefined)).toBeNull();
  });

  it("前缀命中但档位非法时不还原", () => {
    expect(readTextStyleClass("color", "rt-fg-purple")).toBeNull();
  });
});

describe("effectiveTextStyle 与 optionLabelKey", () => {
  it("未设样式时回落到该组默认档", () => {
    expect(effectiveTextStyle("size", null)).toBe("base");
    expect(effectiveTextStyle("color", null)).toBeNull();
    expect(effectiveTextStyle("color", "danger")).toBe("danger");
  });

  it("每个档位都有 i18n 文案", () => {
    for (const [kind, spec] of Object.entries(TEXT_STYLE_SPECS) as [keyof typeof TEXT_STYLE_SPECS, (typeof TEXT_STYLE_SPECS)[keyof typeof TEXT_STYLE_SPECS]][]) {
      for (const value of spec.values) {
        expect(optionLabelKey(kind, value), `${kind}.${value}`).toBeTruthy();
      }
      expect(spec.clearLabelKey).toBeTruthy();
      expect(spec.labelKey).toBeTruthy();
    }
  });
});
