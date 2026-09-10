import { afterEach, describe, expect, it, vi } from "vitest";

const supportApiMock = vi.hoisted(() => ({ log: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/api", () => ({ supportApi: supportApiMock }));

import { installGlobalErrorLogging } from "./global-errors";

/** jsdom 会把未处理的 ErrorEvent 当作未捕获异常抛出，测试里显式阻止默认行为。 */
function dispatchErrorEvent(): void {
  const swallow = (event: ErrorEvent): void => event.preventDefault();
  window.addEventListener("error", swallow);
  window.dispatchEvent(new ErrorEvent("error", { error: new Error("boom"), message: "boom" }));
  window.removeEventListener("error", swallow);
}

describe("installGlobalErrorLogging", () => {
  let cleanup: (() => void) | null = null;

  afterEach(() => {
    cleanup?.();
    cleanup = null;
    supportApiMock.log.mockClear();
  });

  it("捕获 window error 与 unhandledrejection", () => {
    cleanup = installGlobalErrorLogging();

    dispatchErrorEvent();
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: new Error("nope") });
    window.dispatchEvent(rejection);

    expect(supportApiMock.log).toHaveBeenCalledTimes(2);
    expect(supportApiMock.log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("window.onerror"),
      undefined
    );
    expect(supportApiMock.log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("unhandledrejection"),
      undefined
    );
  });

  it("清理后不再捕获", () => {
    const dispose = installGlobalErrorLogging();
    dispose();
    dispatchErrorEvent();
    expect(supportApiMock.log).not.toHaveBeenCalled();
  });
});
