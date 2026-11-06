import { describe, expect, it } from "vitest";
import { visibleSettingsSections } from "./settingsSections";

describe("visibleSettingsSections", () => {
  it("shows MCP only on desktop", () => {
    expect(visibleSettingsSections(true).some((section) => section.id === "mcp")).toBe(true);
    expect(visibleSettingsSections(false).some((section) => section.id === "mcp")).toBe(false);
  });

  it("keeps the existing sections on both shells", () => {
    for (const desktop of [true, false]) {
      const ids = visibleSettingsSections(desktop).map((section) => section.id);
      expect(ids).toContain("repositories");
      expect(ids).toContain("ai");
      expect(ids).toContain("vault");
    }
  });
});
