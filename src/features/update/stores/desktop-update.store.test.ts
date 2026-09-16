import { beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_DESKTOP_UPDATE_STATE, readDismissedVersion, useDesktopUpdateStore } from "./desktop-update.store";

describe("desktop-update store", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
    useDesktopUpdateStore.setState({
      ...INITIAL_DESKTOP_UPDATE_STATE,
      dismissedVersion: null,
      snoozedVersion: null,
    });
  });

  it("dismiss 将版本持久化到 localStorage", () => {
    useDesktopUpdateStore.getState().dismiss("0.25.0");

    expect(globalThis.localStorage?.getItem("ainote.desktop-update.dismissed")).toBe("0.25.0");
    expect(useDesktopUpdateStore.getState().dismissedVersion).toBe("0.25.0");
  });

  it("snooze 仅本次会话生效，不写入 localStorage", () => {
    useDesktopUpdateStore.getState().snooze("0.25.0");

    expect(useDesktopUpdateStore.getState().snoozedVersion).toBe("0.25.0");
    expect(globalThis.localStorage?.getItem("ainote.desktop-update.dismissed")).toBeNull();
  });

  it("localStorage 不可用时按未忽略处理", () => {
    const original = globalThis.localStorage;
    vi.spyOn(globalThis, "localStorage", "get").mockReturnValue(undefined as unknown as Storage);

    expect(readDismissedVersion()).toBeNull();

    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
  });
});
