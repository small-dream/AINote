import { describe, expect, it, vi } from "vitest";

import { createLinkActions, displayableLinkUrl, normalizeLinkInput } from "./links";

describe("platform links", () => {
  it("normalizes urls and preserves internal paths", () => {
    expect(normalizeLinkInput("example.com/a")).toBe("https://example.com/a");
    expect(normalizeLinkInput("mailto:a@example.com")).toBe("mailto:a@example.com");
    expect(normalizeLinkInput("/assets/photo.png")).toBe("/assets/photo.png");
    expect(normalizeLinkInput("javascript:alert(1)")).toBeNull();
  });

  it("shows a compact url without leaking non-http schemes into display", () => {
    expect(displayableLinkUrl("https://example.com/very/long/path?x=1#top")).toBe("example.com/very/long/path?x=1#top");
    expect(displayableLinkUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
    expect(displayableLinkUrl("not a url")).toBe("not a url");
  });

  it("routes copy and open through the platform boundary", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const actions = createLinkActions();
    actions.copyLink("https://example.com");
    expect(writeText).toHaveBeenCalledWith("https://example.com");
  });
});
