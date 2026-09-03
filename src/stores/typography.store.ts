import { create } from "zustand";

export type FontFamily = "sans" | "serif";
export type FontSize = 13 | 14 | 15 | 16 | 17;
export type LineHeight = 1.5 | 1.7 | 1.9 | 2.1;
export type ReadingWidth = 60 | 68 | 72 | 80;

/** 排版偏好持久化键（localStorage，纯前端全局 UI 态，与配色解耦） */
export const FONT_SIZE_STORAGE_KEY = "ainote.note-font-size";
export const LINE_HEIGHT_STORAGE_KEY = "ainote.note-line-height";
export const READING_WIDTH_STORAGE_KEY = "ainote.note-reading-width";
export const FONT_FAMILY_STORAGE_KEY = "ainote.note-font-family";

export const DEFAULT_FONT_SIZE: FontSize = 15;
export const DEFAULT_LINE_HEIGHT: LineHeight = 1.7;
export const DEFAULT_READING_WIDTH: ReadingWidth = 72;
export const DEFAULT_FONT_FAMILY: FontFamily = "sans";

const FONT_SIZES: ReadonlyArray<number> = [13, 14, 15, 16, 17];
const LINE_HEIGHTS: ReadonlyArray<number> = [1.5, 1.7, 1.9, 2.1];
const READING_WIDTHS: ReadonlyArray<number> = [60, 68, 72, 80];

function isLocalStorageAvailable(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const probe = "__ainote_ls_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const localStorageAvailable = isLocalStorageAvailable();

/** 解析排版偏好；非法值一律回退默认值（字号 15 / 行高 1.7 / 宽度 72ch / 无衬线）。 */
export function parseFontSize(value: string | null): FontSize {
  const number = Number(value);
  return FONT_SIZES.includes(number) ? (number as FontSize) : DEFAULT_FONT_SIZE;
}

export function parseLineHeight(value: string | null): LineHeight {
  const number = Number(value);
  return LINE_HEIGHTS.includes(number) ? (number as LineHeight) : DEFAULT_LINE_HEIGHT;
}

export function parseReadingWidth(value: string | null): ReadingWidth {
  const number = Number(value);
  return READING_WIDTHS.includes(number) ? (number as ReadingWidth) : DEFAULT_READING_WIDTH;
}

export function parseFontFamily(value: string | null): FontFamily {
  return value === "serif" ? "serif" : "sans";
}

function readValue(key: string): string | null {
  return localStorageAvailable ? localStorage.getItem(key) : null;
}

function writeValue(key: string, value: string): void {
  if (!localStorageAvailable) return;
  localStorage.setItem(key, value);
}

interface TypographyState {
  fontSize: FontSize;
  lineHeight: LineHeight;
  readingWidth: ReadingWidth;
  fontFamily: FontFamily;
  setFontSize: (fontSize: FontSize) => void;
  setLineHeight: (lineHeight: LineHeight) => void;
  setReadingWidth: (readingWidth: ReadingWidth) => void;
  setFontFamily: (fontFamily: FontFamily) => void;
}

export const useTypographyStore = create<TypographyState>((set) => ({
  fontSize: parseFontSize(readValue(FONT_SIZE_STORAGE_KEY)),
  lineHeight: parseLineHeight(readValue(LINE_HEIGHT_STORAGE_KEY)),
  readingWidth: parseReadingWidth(readValue(READING_WIDTH_STORAGE_KEY)),
  fontFamily: parseFontFamily(readValue(FONT_FAMILY_STORAGE_KEY)),
  setFontSize: (fontSize) => {
    writeValue(FONT_SIZE_STORAGE_KEY, String(fontSize));
    set({ fontSize });
  },
  setLineHeight: (lineHeight) => {
    writeValue(LINE_HEIGHT_STORAGE_KEY, String(lineHeight));
    set({ lineHeight });
  },
  setReadingWidth: (readingWidth) => {
    writeValue(READING_WIDTH_STORAGE_KEY, String(readingWidth));
    set({ readingWidth });
  },
  setFontFamily: (fontFamily) => {
    writeValue(FONT_FAMILY_STORAGE_KEY, fontFamily);
    set({ fontFamily });
  },
}));
