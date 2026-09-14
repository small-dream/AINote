import { describe, expect, it, vi } from "vitest";
import { clampContextMenuPosition } from "./contextMenuPosition";

describe("clampContextMenuPosition", () => {
  it("keeps the menu inside the viewport", () => {
    vi.stubGlobal("innerWidth", 800);
    vi.stubGlobal("innerHeight", 600);
    expect(clampContextMenuPosition({ x: 780, y: 580 }, 200, 120)).toEqual({ x: 592, y: 472 });
  });

  it("handles viewports smaller than the menu", () => {
    vi.stubGlobal("innerWidth", 100);
    vi.stubGlobal("innerHeight", 80);
    expect(clampContextMenuPosition({ x: 80, y: 70 }, 300, 400)).toEqual({ x: 8, y: 8 });
  });
});
