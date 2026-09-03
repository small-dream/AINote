import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_READING_WIDTH,
  FONT_FAMILY_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  LINE_HEIGHT_STORAGE_KEY,
  READING_WIDTH_STORAGE_KEY,
  parseFontFamily,
  parseFontSize,
  parseLineHeight,
  parseReadingWidth,
  useTypographyStore,
} from "./typography.store";

function resetStore(): void {
  useTypographyStore.setState({
    fontSize: DEFAULT_FONT_SIZE,
    lineHeight: DEFAULT_LINE_HEIGHT,
    readingWidth: DEFAULT_READING_WIDTH,
    fontFamily: DEFAULT_FONT_FAMILY,
  });
}

describe("typography.store 排版偏好解析与持久化", () => {
  beforeEach(() => {
    localStorage.clear();
    resetStore();
  });

  it("解析非法值回退默认排版", () => {
    expect(parseFontSize("16")).toBe(16);
    expect(parseFontSize("99")).toBe(DEFAULT_FONT_SIZE);
    expect(parseLineHeight("1.9")).toBe(1.9);
    expect(parseLineHeight("3")).toBe(DEFAULT_LINE_HEIGHT);
    expect(parseReadingWidth("80")).toBe(80);
    expect(parseReadingWidth("0")).toBe(DEFAULT_READING_WIDTH);
    expect(parseFontFamily("serif")).toBe("serif");
    expect(parseFontFamily("unknown")).toBe("sans");
  });

  it("更新偏好并写入 localStorage", () => {
    useTypographyStore.getState().setFontSize(16);
    useTypographyStore.getState().setLineHeight(1.9);
    useTypographyStore.getState().setReadingWidth(80);
    useTypographyStore.getState().setFontFamily("serif");

    expect(useTypographyStore.getState()).toMatchObject({ fontSize: 16, lineHeight: 1.9, readingWidth: 80, fontFamily: "serif" });
    expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe("16");
    expect(localStorage.getItem(LINE_HEIGHT_STORAGE_KEY)).toBe("1.9");
    expect(localStorage.getItem(READING_WIDTH_STORAGE_KEY)).toBe("80");
    expect(localStorage.getItem(FONT_FAMILY_STORAGE_KEY)).toBe("serif");
  });
});
