import { describe, expect, it } from "vitest";
import { errorActionOf, isAppError, messageOf, type AppError } from "./error";

describe("isAppError", () => {
  it("识别 AppError 结构", () => {
    const value = { code: "SYNC_4001", kind: "conflict", message: "冲突", retriable: true };
    expect(isAppError(value)).toBe(true);
  });

  it("拒绝普通对象", () => {
    expect(isAppError({ code: "x" })).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("messageOf", () => {
  it("AppError 用其 message", () => {
    expect(messageOf({ code: "A", kind: "auth", message: "token 无效", retriable: false })).toBe(
      "token 无效"
    );
  });

  it("Error 实例", () => {
    expect(messageOf(new Error("boom"))).toBe("boom");
  });

  it("其他值转字符串", () => {
    expect(messageOf(42)).toBe("42");
  });
});

function syncError(code: string, kind: AppError["kind"], retriable: boolean): AppError {
  return { code, kind, message: code, retriable };
}

describe("errorActionOf", () => {
  it("网络错误建议重试", () => {
    expect(errorActionOf(syncError("SYNC_4002", "network", true))).toBe("retry");
  });

  it("凭证失效建议重新登录", () => {
    expect(errorActionOf(syncError("SYNC_4003", "auth", false))).toBe("relogin");
  });

  it("远端拒绝建议检查权限", () => {
    expect(errorActionOf(syncError("SYNC_4004", "permission", false))).toBe("checkPermission");
  });

  it("未知错误不给建议", () => {
    expect(errorActionOf(syncError("GIT_4001", "unknown", true))).toBeNull();
  });
});
