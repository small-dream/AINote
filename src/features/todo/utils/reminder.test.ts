import { describe, expect, it } from "vitest";
import {
  REMINDER_PRESETS,
  remindAtForPreset,
  remindAtOnDueDay,
  reminderClock,
  reminderLeadMinutes,
  reminderPresetOf,
  shiftReminderOnDueChange,
} from "./reminder";

const DUE = "2026-09-20T18:00";

describe("reminderLeadMinutes", () => {
  it("算出提醒比截止时刻提前的分钟数", () => {
    expect(reminderLeadMinutes(DUE, remindAtForPreset(DUE, 0))).toBe(0);
    expect(reminderLeadMinutes(DUE, remindAtForPreset(DUE, 15))).toBe(15);
    expect(reminderLeadMinutes(DUE, remindAtForPreset(DUE, 1440))).toBe(1440);
  });

  it("非法时间返回 null", () => {
    expect(reminderLeadMinutes(DUE, "not-a-date")).toBeNull();
  });
});

describe("reminderPresetOf", () => {
  it("能匹配到预设", () => {
    expect(reminderPresetOf(DUE, remindAtForPreset(DUE, 30))?.minutes).toBe(30);
  });

  it("只到天的默认提醒属于自定义时刻而非预设", () => {
    expect(reminderPresetOf("2026-09-20", remindAtOnDueDay("2026-09-20", "09:00"))).toBeNull();
  });

  it("预设覆盖准时到提前一天", () => {
    expect(REMINDER_PRESETS.map((preset) => preset.minutes)).toEqual([0, 5, 15, 30, 60, 1440]);
  });
});

describe("remindAtOnDueDay", () => {
  it("按截止日当天给出本地钟点", () => {
    const value = remindAtOnDueDay("2026-09-20T18:00", "08:30");
    expect(reminderClock(value)).toBe("08:30");
    expect(new Date(value).getDate()).toBe(20);
  });
});

describe("reminderClock", () => {
  it("无提醒或非法时间回退默认 09:00", () => {
    expect(reminderClock(null)).toBe("09:00");
    expect(reminderClock("not-a-date")).toBe("09:00");
  });
});

describe("shiftReminderOnDueChange", () => {
  it("相对型提醒跟着新的截止时间走", () => {
    const remindAt = remindAtForPreset(DUE, 15);
    const next = shiftReminderOnDueChange(DUE, "2026-09-22T18:00", remindAt);
    expect(reminderLeadMinutes("2026-09-22T18:00", next as string)).toBe(15);
  });

  it("自定义钟点保持不变", () => {
    const custom = remindAtOnDueDay(DUE, "08:30");
    expect(shiftReminderOnDueChange(DUE, "2026-09-22T18:00", custom)).toBe(custom);
  });

  it("截止时间清空或本来无提醒时返回 null", () => {
    expect(shiftReminderOnDueChange(DUE, null, remindAtForPreset(DUE, 5))).toBeNull();
    expect(shiftReminderOnDueChange(DUE, "2026-09-22T18:00", null)).toBeNull();
  });
});
