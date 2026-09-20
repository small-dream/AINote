import { describe, expect, it } from "vitest";
import { createdDayLabel, shortDayLabel } from "./dateLabel";

describe("shortDayLabel", () => {
  const now = new Date(2026, 8, 15, 12, 0);

  it("同年只显示月-日", () => {
    expect(shortDayLabel("2026-09-20", now)).toBe("09-20");
  });

  it("跨年补上完整年份", () => {
    expect(shortDayLabel("2027-01-15", now)).toBe("2027-01-15");
  });

  it("跨年边界：12-31 看次年 01-01 仍带年份", () => {
    expect(shortDayLabel("2027-01-01", new Date(2026, 11, 31, 23, 0))).toBe("2027-01-01");
  });

  it("带时刻的输入只取日期部分", () => {
    expect(shortDayLabel("2026-10-08T18:00", now)).toBe("10-08");
  });
});

describe("createdDayLabel", () => {
  const now = new Date(2026, 8, 15, 12, 0);

  it("RFC3339 转本地日期，同年显示月-日", () => {
    expect(createdDayLabel("2026-09-01T08:00:00.000Z", now)).toBe("09-01");
  });

  it("跨年创建补上完整年份", () => {
    expect(createdDayLabel(new Date(2025, 11, 31, 10, 0).toISOString(), now)).toBe("2025-12-31");
  });

  it("非法时间返回 null", () => {
    expect(createdDayLabel("not-a-date", now)).toBeNull();
  });
});
