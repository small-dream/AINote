import { describe, expect, it } from "vitest";
import { displayShortcut, shortcutFromEvent } from "./shortcut";

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("capture shortcut", () => {
  it("规范化修饰键与按键", () => {
    expect(shortcutFromEvent(keydown({ key: " ", ctrlKey: true, shiftKey: true }))).toBe("CommandOrControl+Shift+Space");
    expect(shortcutFromEvent(keydown({ key: "k", metaKey: true, altKey: true }))).toBe("CommandOrControl+Alt+K");
  });

  it("拒绝无修饰键的普通按键并允许功能键", () => {
    expect(shortcutFromEvent(keydown({ key: "a" }))).toBeNull();
    expect(shortcutFromEvent(keydown({ key: "F8" }))).toBe("F8");
    expect(displayShortcut("CommandOrControl+Shift+Space")).toContain("Ctrl/Cmd");
  });
});
