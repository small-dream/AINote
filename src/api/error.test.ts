import { describe, expect, it } from "vitest";
import { isAppError, messageOf } from "./error";

describe("isAppError", () => {
  it("识别 AppError 结构", () => {
    const value = { code: "SYNC_4001", kind: "Conflict", message: "冲突", retriable: true };
    expect(isAppError(value)).toBe(true);
  });

  it("拒绝普通对象", () => {
    expect(isAppError({ code: "x" })).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("messageOf", () => {
  it("AppError 用其 message", () => {
    expect(messageOf({ code: "A", kind: "Auth", message: "token 无效", retriable: false })).toBe(
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
