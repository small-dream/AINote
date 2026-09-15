import { describe, expect, it } from "vitest";
import { monthGrid, monthLabel, monthOf, shiftMonth, weekdayLabels, MONTH_GRID_SIZE } from "./calendar";

describe("shiftMonth", () => {
  it("同年内平移", () => {
    expect(shiftMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
    expect(shiftMonth(2026, 8, -1)).toEqual({ year: 2026, month: 7 });
  });

  it("跨年进位与借位", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 0, -13)).toEqual({ year: 2024, month: 11 });
  });
});

describe("monthGrid", () => {
  it("固定 42 格且周一起始", () => {
    const grid = monthGrid(2026, 8);
    expect(grid.cells).toHaveLength(MONTH_GRID_SIZE);
    // 2026-09-01 是周二，网格首格应为 2026-08-31（周一）
    expect(grid.cells[0]).toEqual({ date: "2026-08-31", day: 31, inMonth: false });
    expect(grid.cells[1]).toEqual({ date: "2026-09-01", day: 1, inMonth: true });
  });

  it("整月覆盖且补位日期标记为非本月", () => {
    const grid = monthGrid(2026, 1);
    const current = grid.cells.filter((cell) => cell.inMonth);
    expect(current).toHaveLength(28);
    expect(current[0]?.date).toBe("2026-02-01");
    expect(current.at(-1)?.date).toBe("2026-02-28");
  });

  it("闰年 2 月有 29 天且跨年补位正确", () => {
    const leap = monthGrid(2024, 1);
    expect(leap.cells.filter((cell) => cell.inMonth)).toHaveLength(29);
    const january = monthGrid(2026, 0);
    expect(january.cells[0]?.date).toBe("2025-12-29");
  });
});

describe("monthOf", () => {
  it("解析出年月", () => {
    expect(monthOf("2026-09-20")).toEqual({ year: 2026, month: 8 });
    expect(monthOf("2026-01-01")).toEqual({ year: 2026, month: 0 });
  });
});

describe("locale 文案", () => {
  it("中文月份与星期表头", () => {
    expect(monthLabel(2026, 8, "zh-CN")).toBe("2026年9月");
    expect(weekdayLabels("zh-CN")).toEqual(["一", "二", "三", "四", "五", "六", "日"]);
  });

  it("英文月份与星期表头", () => {
    expect(monthLabel(2026, 8, "en-US")).toBe("September 2026");
    expect(weekdayLabels("en-US")).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });
});
