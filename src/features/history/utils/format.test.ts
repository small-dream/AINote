import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formats unix seconds to local datetime", () => {
    // 2026-08-31 10:30 local; timestamp from Date.UTC to keep test env-agnostic
    const ts = Math.floor(new Date(2026, 7, 31, 10, 30).getTime() / 1000);
    expect(formatDate(ts)).toBe("2026-08-31 10:30");
  });

  it("returns empty for zero timestamp", () => {
    expect(formatDate(0)).toBe("");
  });
});
