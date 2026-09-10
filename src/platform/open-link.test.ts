import { beforeEach, describe, expect, it, vi } from "vitest";
import { isExternalHttpUrl, openExternalLink } from "./open-link";

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn(() => Promise.resolve()),
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("@/api", () => ({ openExternal: mocks.openExternal }));
vi.mock("@/api/back-button.api", () => ({ isTauriRuntime: mocks.isTauriRuntime }));

beforeEach(() => {
  mocks.openExternal.mockClear();
  mocks.isTauriRuntime.mockReset();
  mocks.isTauriRuntime.mockReturnValue(true);
  vi.spyOn(window, "open").mockImplementation(() => null);
});

describe("isExternalHttpUrl", () => {
  it("只接受 http / https（大小写不敏感）", () => {
    expect(isExternalHttpUrl("https://example.com")).toBe(true);
    expect(isExternalHttpUrl("HTTP://example.com")).toBe(true);
    expect(isExternalHttpUrl("mailto:a@example.com")).toBe(false);
    expect(isExternalHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isExternalHttpUrl(undefined)).toBe(false);
  });
});

describe("openExternalLink", () => {
  it("壳内交给 Rust open_external", async () => {
    await openExternalLink("https://example.com/a");

    expect(mocks.openExternal).toHaveBeenCalledWith("https://example.com/a");
    expect(window.open).not.toHaveBeenCalled();
  });

  it("浏览器环境退回新标签页", async () => {
    mocks.isTauriRuntime.mockReturnValue(false);

    await openExternalLink("https://example.com/a");

    expect(window.open).toHaveBeenCalledWith("https://example.com/a", "_blank", "noopener,noreferrer");
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });
});
