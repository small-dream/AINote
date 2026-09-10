import { describe, expect, it, vi } from "vitest";

const supportApiMock = vi.hoisted(() => ({ log: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/api", () => ({ supportApi: supportApiMock }));

import { formatErrorReport, reportFrontendError } from "./error-report";

describe("formatErrorReport", () => {
  it("包含来源、时间、错误名与消息", () => {
    const report = formatErrorReport(new Error("boom"), "test");
    expect(report).toContain("source: test");
    expect(report).toContain("name: Error");
    expect(report).toContain("message: boom");
    expect(report).toContain("time: ");
  });

  it("非 Error 值可序列化", () => {
    expect(formatErrorReport({ code: 1 }, "x")).toContain('message: {"code":1}');
    expect(formatErrorReport("plain", "x")).toContain("message: plain");
  });

  it("循环引用不抛错", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(() => formatErrorReport(value, "x")).not.toThrow();
  });
});

describe("reportFrontendError", () => {
  it("以 error 级别上报并携带上下文", () => {
    reportFrontendError(new Error("boom"), "test", "at <App>");
    expect(supportApiMock.log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("boom"),
      "at <App>"
    );
  });
});
