import { describe, expect, it } from "vitest";
import { repoNameOf } from "./repoName";

describe("repoNameOf", () => {
  it("returns the last path segment", () => {
    expect(repoNameOf("/Users/jake/notes")).toBe("notes");
    expect(repoNameOf("/Users/jake/notes/")).toBe("notes");
    expect(repoNameOf("C:\\Users\\jake\\notes")).toBe("notes");
    expect(repoNameOf("notes")).toBe("notes");
    expect(repoNameOf(null)).toBe("");
  });
});
