import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supportApiMock = vi.hoisted(() => ({ log: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/api", () => ({ supportApi: supportApiMock }));

import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    supportApiMock.log.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("渲染崩溃时显示可恢复界面并上报日志", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText("应用遇到问题")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
    expect(supportApiMock.log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("react-render"),
      expect.any(String)
    );
  });

  it("点击重试后重新渲染子树", () => {
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error("boom");
      return <div>恢复成功</div>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByText("重试"));
    expect(screen.getByText("恢复成功")).toBeTruthy();
  });

  it("复制诊断信息写入剪贴板", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText("复制诊断信息"));

    expect(await screen.findByText("已复制")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("message: boom"));
  });
});
