import { describe, expect, it } from "vitest";
import { favoritePathsOf, favoriteDisplayName } from "./favorites";

const note = { path: "daily/a.md", kind: "markdown" as const, title: "First", updatedAt: 1 };

describe("favorites utils", () => {
  it("collects favorite paths", () => {
    expect(favoritePathsOf([note, { ...note, path: "b.md" }])).toEqual(
      new Set(["daily/a.md", "b.md"]),
    );
  });

  it("falls back to file name when title is empty", () => {
    expect(favoriteDisplayName({ ...note, title: "" })).toBe("a.md");
    expect(favoriteDisplayName(note)).toBe("First");
  });
});
