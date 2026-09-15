import { describe, expect, it } from "vitest";
import { detectNativeInput, supportsNativeInput, type InputFactory } from "./native-datetime";

/** 模拟「识别不了 date，退化成 text」的 WebView */
function fallbackFactory(): InputFactory {
  return () => ({ type: "text", setAttribute: () => undefined } as unknown as HTMLInputElement);
}

describe("detectNativeInput", () => {
  it("保留 type=date / type=time 的环境判定为可用（jsdom 走真实 DOM 也会保留）", () => {
    expect(detectNativeInput("date", () => document.createElement("input"))).toBe(true);
    expect(detectNativeInput("time", () => document.createElement("input"))).toBe(true);
  });

  it("退化成 text 的环境判定为不可用", () => {
    expect(detectNativeInput("date", fallbackFactory())).toBe(false);
  });

  it("探测过程抛错时按不可用处理", () => {
    expect(detectNativeInput("date", () => { throw new Error("no dom"); })).toBe(false);
  });

  it("supportsNativeInput 走缓存且与纯检测结论一致", () => {
    const first = supportsNativeInput("date");
    expect(first).toBe(detectNativeInput("date", () => document.createElement("input")));
    expect(supportsNativeInput("date")).toBe(first);
  });
});
