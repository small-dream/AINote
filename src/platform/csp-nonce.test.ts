import { beforeEach, describe, expect, it } from "vitest";
import { readCspNonce } from "./csp-nonce";

beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

describe("readCspNonce", () => {
  it("读取内联 style 上的 nonce（生产壳注入）", () => {
    document.head.append(makeElement("style", "nonce-a1b2"));

    expect(readCspNonce(document)).toBe("nonce-a1b2");
  });

  it("style 无 nonce 时回退到 script", () => {
    document.head.append(makeElement("style"), makeElement("script", "nonce-script"));

    expect(readCspNonce(document)).toBe("nonce-script");
  });

  it("没有 nonce 时返回 undefined（dev / 浏览器环境）", () => {
    document.head.append(makeElement("style"), makeElement("script"));

    expect(readCspNonce(document)).toBeUndefined();
  });

  it("空 nonce 视为不存在", () => {
    document.head.append(makeElement("style", ""));

    expect(readCspNonce(document)).toBeUndefined();
  });

  it("无 document 时安全返回 undefined", () => {
    expect(readCspNonce(undefined)).toBeUndefined();
  });
});

function makeElement(tag: "style" | "script", nonce?: string): HTMLElement {
  const element = document.createElement(tag);
  if (nonce !== undefined) element.setAttribute("nonce", nonce);
  return element;
}
