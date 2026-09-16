import { describe, expect, it } from "vitest";
import { MIN_PASSPHRASE_CHARS, isStrongPassphrase, passphraseIssue } from "./passphrase";

describe("passphrase rules", () => {
  it("enforces the minimum length in characters, not bytes", () => {
    expect(passphraseIssue("a".repeat(MIN_PASSPHRASE_CHARS - 1))).toBe("tooShort");
    expect(passphraseIssue("a".repeat(MIN_PASSPHRASE_CHARS))).toBeNull();
    expect(passphraseIssue("很短的口令")).toBe("tooShort");
    expect(passphraseIssue("中文口令也可以很长很好记的")).toBeNull();
  });

  it("rejects pure digits and reused context", () => {
    expect(passphraseIssue("123456")).toBe("numericOnly");
    expect(passphraseIssue("MyRepo-notes", ["myrepo-notes"])).toBe("matchesContext");
    expect(passphraseIssue("MyRepo-notes", ["  "])).toBeNull();
  });

  it("checks length before the other rules so the message stays actionable", () => {
    expect(passphraseIssue("12345", [])).toBe("tooShort");
  });

  it("exposes a boolean helper for form gating", () => {
    expect(isStrongPassphrase("correct horse battery")).toBe(true);
    expect(isStrongPassphrase("short")).toBe(false);
  });
});
