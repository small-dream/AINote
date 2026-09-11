import { describe, expect, it, vi } from "vitest";
import { LINK_INPUT_EVENT, normalizeLinkUrl, requestLinkInput } from "./linkUrl";

describe("normalizeLinkUrl", () => {
  it("接受完整 http/https URL 并保留原样", () => {
    expect(normalizeLinkUrl("https://example.com/a?x=1")).toBe("https://example.com/a?x=1");
    expect(normalizeLinkUrl("http://sub.example.co.uk")).toBe("http://sub.example.co.uk");
  });

  it("裸域名自动补 https:// 前缀", () => {
    expect(normalizeLinkUrl("example.com")).toBe("https://example.com");
    expect(normalizeLinkUrl("example.com/docs/intro")).toBe("https://example.com/docs/intro");
    expect(normalizeLinkUrl("  example.com:8080/x ")).toBe("https://example.com:8080/x");
  });

  it("允许 mailto、锚点与站内相对路径", () => {
    expect(normalizeLinkUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(normalizeLinkUrl("#section")).toBe("#section");
    expect(normalizeLinkUrl("/docs/readme.md")).toBe("/docs/readme.md");
    expect(normalizeLinkUrl("../other.md")).toBe("../other.md");
  });

  it("拒绝非法输入", () => {
    expect(normalizeLinkUrl("")).toBeNull();
    expect(normalizeLinkUrl("   ")).toBeNull();
    expect(normalizeLinkUrl("not a url")).toBeNull();
    expect(normalizeLinkUrl("ftp://example.com")).toBeNull();
    expect(normalizeLinkUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("requestLinkInput", () => {
  it("在目标 DOM 上派发冒泡事件，window 可接收", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onEvent = vi.fn();
    window.addEventListener(LINK_INPUT_EVENT, onEvent);

    requestLinkInput(target);

    expect(onEvent).toHaveBeenCalledTimes(1);
    window.removeEventListener(LINK_INPUT_EVENT, onEvent);
    target.remove();
  });
});
