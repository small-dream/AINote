import { describe, expect, it } from "vitest";
import { isEnvelopeText } from "./envelope";

describe("isEnvelopeText", () => {
  it("识别信封首行，容忍 CRLF 与折行载荷", () => {
    expect(isEnvelopeText("AINOTE-ENC-v1\nQUJD\nREVG\n")).toBe(true);
    expect(isEnvelopeText("AINOTE-ENC-v1\r\nQUJD\r\n")).toBe(true);
    expect(isEnvelopeText("AINOTE-ENC-v1\n")).toBe(true);
  });

  it("普通 Markdown、空值与 null 都视为非密文", () => {
    expect(isEnvelopeText("# 普通笔记\n正文")).toBe(false);
    expect(isEnvelopeText("正文里提到 AINOTE-ENC-v1 不算信封")).toBe(false);
    expect(isEnvelopeText("")).toBe(false);
    expect(isEnvelopeText(null)).toBe(false);
    expect(isEnvelopeText(undefined)).toBe(false);
  });
});
