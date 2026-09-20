import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import type { TaskDraft } from "../utils/taskDraft";
import { TASK_AUTOSAVE_DEBOUNCE_MS, useTaskEditor } from "./useTaskEditor";

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "t-1",
    title: "写周报",
    description: "",
    done: false,
    priority: "none",
    dueAt: null,
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function setup(overrides: { task?: TaskItemDto; onSave?: (draft: TaskDraft) => Promise<void> } = {}) {
  const onSave = vi.fn(overrides.onSave ?? (async () => {}));
  const onClose = vi.fn();
  const view = renderHook(
    ({ currentTask }: { currentTask: TaskItemDto }) => useTaskEditor({ task: currentTask, onSave, onClose }),
    { initialProps: { currentTask: overrides.task ?? task() } },
  );
  return { ...view, onSave, onClose };
}

/** 让防抖窗口走完（含到期后提交的微任务）。 */
async function runDebounce(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(TASK_AUTOSAVE_DEBOUNCE_MS); });
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("useTaskEditor 自动保存", () => {
  it("标题改动在防抖窗口内不落盘，到期后才写一次", async () => {
    const { result, onSave } = setup();

    act(() => result.current.setTitle("交周报"));
    await act(async () => { vi.advanceTimersByTime(TASK_AUTOSAVE_DEBOUNCE_MS - 1); });
    expect(onSave).not.toHaveBeenCalled();

    await runDebounce();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "交周报" }));
  });

  it("保存成功后立刻回到「未改动」，不等服务端快照回来", async () => {
    const { result } = setup();

    act(() => result.current.setTitle("交周报"));
    expect(result.current.dirty).toBe(true);

    await runDebounce();
    expect(result.current.dirty).toBe(false);
    expect(result.current.status).toBe("saved");
  });

  it("元数据 chips 即改即存，不等防抖窗口", async () => {
    const { result, onSave } = setup();

    await act(async () => { result.current.commitPriority("high"); });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ priority: "high" }));
  });

  it("改截止日期时相对提醒跟着迁移，两件事一次提交", async () => {
    const { result, onSave } = setup({
      task: task({ dueAt: "2026-09-21T18:00", remindAt: "2026-09-21T17:45" }),
    });

    await act(async () => { result.current.commitDueDate("2026-09-22T18:00"); });

    // 提醒时刻落盘为绝对值：断言它与新截止时间仍差同一个提前量，而非某个具体字符串形态
    const saved = onSave.mock.calls[0]?.[0];
    expect(saved?.dueAt).toBe("2026-09-22T18:00");
    expect(Date.parse(String(saved?.dueAt)) - Date.parse(String(saved?.remindAt))).toBe(15 * 60_000);
  });
});

describe("useTaskEditor 收起与失败", () => {
  it("没有任何改动时失焦保存不提交，避免凭空产生一次工作区变更", async () => {
    const { result, onSave } = setup();

    await act(async () => { await result.current.save(); });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("重复点中同一个 chip 不重复提交", async () => {
    const { result, onSave } = setup({ task: task({ priority: "high" }) });

    await act(async () => { result.current.commitPriority("high"); });

    expect(onSave).not.toHaveBeenCalled();
  });

  it("收起编辑器前先提交最后一份草稿，成功才关闭", async () => {
    const { result, onSave, onClose } = setup();

    act(() => result.current.setTitle("交周报"));
    await act(async () => { await result.current.close(); });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("没有改动时收起不产生多余写入", async () => {
    const { result, onSave, onClose } = setup();

    await act(async () => { await result.current.close(); });

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("保存失败时不关闭编辑器，草稿、失败状态与重试入口都留着", async () => {
    const { result, onClose } = setup({ onSave: async () => { throw new Error("磁盘已满"); } });

    act(() => result.current.setTitle("交周报"));
    await act(async () => { await result.current.close(); });

    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.title).toBe("交周报");
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("磁盘已满");
  });

  it("标题为空既不落盘也不关闭，避免把空标题写进仓库", async () => {
    const { result, onSave, onClose } = setup();

    act(() => result.current.setTitle("   "));
    await runDebounce();
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => { await result.current.close(); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("卸载兜底：还没到防抖窗口就切走时补交这份改动", async () => {
    const { result, onSave, unmount } = setup();

    act(() => result.current.setTitle("交周报"));
    unmount();
    vi.useRealTimers();

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "交周报" })));
  });
});

describe("useTaskEditor 与服务端对齐", () => {
  it("外部改动了这条任务且本地无编辑时，整份采纳新内容", async () => {
    const { result, rerender } = setup();

    rerender({ currentTask: task({ remindAt: "2026-09-15T09:10:00.000Z", updatedAt: "2026-09-15T09:00:00.000Z" }) });
    vi.useRealTimers();

    await waitFor(() => expect(result.current.remindAt).toBe("2026-09-15T09:10:00.000Z"));
    expect(result.current.dirty).toBe(false);
  });

  it("外部改动落到正在编辑的草稿上时保留草稿，不把旧值当成新改动写回去", async () => {
    const { result, rerender, onSave } = setup();

    act(() => result.current.setTitle("交周报"));
    rerender({ currentTask: task({ remindAt: "2026-09-15T09:10:00.000Z", updatedAt: "2026-09-15T09:00:00.000Z" }) });

    expect(result.current.title).toBe("交周报");
    await runDebounce();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "交周报" }));
  });
});
