import { describe, expect, it } from "vitest";
import { resolveViewMode, usesSoftRender } from "./viewMode";

describe("resolveViewMode", () => {
  it("窄屏用源码替代分栏", () => {
    expect(resolveViewMode("split", true)).toBe("source");
    expect(resolveViewMode("source", true)).toBe("source");
    expect(resolveViewMode("edit", true)).toBe("edit");
    expect(resolveViewMode("preview", true)).toBe("preview");
  });

  it("宽屏用分栏替代源码", () => {
    expect(resolveViewMode("source", false)).toBe("split");
    expect(resolveViewMode("split", false)).toBe("split");
    expect(resolveViewMode("edit", false)).toBe("edit");
    expect(resolveViewMode("preview", false)).toBe("preview");
  });
});

describe("usesSoftRender", () => {
  it("仅源码与分栏关闭软渲染", () => {
    expect(usesSoftRender("edit")).toBe(true);
    expect(usesSoftRender("preview")).toBe(true);
    expect(usesSoftRender("source")).toBe(false);
    expect(usesSoftRender("split")).toBe(false);
  });
});
