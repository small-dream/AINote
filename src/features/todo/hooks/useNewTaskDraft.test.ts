import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { remindAtForPreset } from "../utils/reminder";
import { localDateString, addLocalDays } from "../utils/task";
import { useNewTaskDraft } from "./useNewTaskDraft";

describe("useNewTaskDraft", () => {
  it("从标题中识别日期与优先级", () => {
    const { result } = renderHook(() => useNewTaskDraft());

    act(() => result.current.setTitle("写周报 明天 p1"));

    expect(result.current.valid).toBe(true);
    expect(result.current.toInput()).toMatchObject({
      title: "写周报",
      dueAt: localDateString(addLocalDays(new Date(), 1)),
      priority: "high",
      remindAt: null,
    });
  });

  it("手动覆盖优先于识别结果", () => {
    const { result } = renderHook(() => useNewTaskDraft());

    act(() => result.current.setTitle("写周报 明天 p1"));
    act(() => result.current.changeDueAt("2026-09-30"));
    act(() => result.current.setPriority("low"));

    expect(result.current.toInput()).toMatchObject({ dueAt: "2026-09-30", priority: "low" });
  });

  it("清除截止日期时一并清掉提醒，避免提交无日期的提醒", () => {
    const { result } = renderHook(() => useNewTaskDraft());

    act(() => result.current.changeDueAt("2026-09-30"));
    act(() => result.current.setRemindAt(remindAtForPreset("2026-09-30", 15)));
    expect(result.current.toInput().remindAt).toBe(remindAtForPreset("2026-09-30", 15));

    act(() => result.current.changeDueAt(null));
    expect(result.current.remindAt).toBeNull();
    expect(result.current.toInput().remindAt).toBeNull();
  });

  it("没有截止日期时不落盘提醒，避免出现无依附的提醒", () => {
    const { result } = renderHook(() => useNewTaskDraft());

    act(() => result.current.setRemindAt(remindAtForPreset("2026-09-30", 0)));

    expect(result.current.toInput()).toMatchObject({ dueAt: null, remindAt: null });
  });

  it("空标题不可提交，描述按 trim 归一", () => {
    const { result } = renderHook(() => useNewTaskDraft());
    expect(result.current.valid).toBe(false);

    act(() => result.current.setTitle("回邮件"));
    act(() => result.current.setDescription("  先确认时间  "));

    expect(result.current.toInput()).toEqual({
      title: "回邮件",
      description: "先确认时间",
      dueAt: null,
      priority: "none",
      remindAt: null,
    });
  });
});
