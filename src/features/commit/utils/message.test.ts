import { describe, expect, it } from "vitest";
import { buildCommitMessage, formatTimestamp } from "./message";

describe("buildCommitMessage", () => {
  it("returns empty for no files", () => {
    expect(buildCommitMessage([], new Date(2026, 8, 10, 14, 30))).toBe("");
  });

  it("builds subject with timestamp and file count", () => {
    const message = buildCommitMessage(
      [{ path: "daily/2026-09-10.md", status: "modified" }],
      new Date(2026, 8, 10, 14, 30),
    );
    expect(message).toBe("chore: 2026-09-10 14:30 · 更新 1 个文件\n\nM daily/2026-09-10.md");
  });

  it("keeps mixed statuses in given order", () => {
    const message = buildCommitMessage(
      [
        { path: "a.md", status: "modified" },
        { path: "new.md", status: "added" },
        { path: "old.md", status: "deleted" },
      ],
      new Date(2026, 8, 10, 14, 30),
    );
    expect(message).toContain("M a.md");
    expect(message).toContain("A new.md");
    expect(message).toContain("D old.md");
    expect(message).toContain("更新 3 个文件");
  });
});

describe("formatTimestamp", () => {
  it("pads single digits", () => {
    expect(formatTimestamp(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05 09:07");
  });
});
