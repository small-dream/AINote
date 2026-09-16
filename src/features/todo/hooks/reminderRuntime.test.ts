import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { useReminderAlertStore } from "@/stores/reminderAlert.store";

const mocks = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  cancel: vi.fn<(ids: number[]) => Promise<void>>(async () => undefined),
  pending: vi.fn(async () => [] as Array<{ id: number }>),
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => "granted"),
  isMobile: vi.fn(() => false),
  isIos: vi.fn(() => false),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  pending: mocks.pending,
  cancel: mocks.cancel,
  sendNotification: mocks.sendNotification,
  Schedule: { at: (date: Date) => ({ at: { date, repeating: false, allowWhileIdle: false } }) },
}));

vi.mock("@/platform/runtime", () => ({ isMobileApp: () => mocks.isMobile(), isIosApp: () => mocks.isIos() }));
vi.mock("@/api/back-button.api", () => ({ isTauriRuntime: () => true }));

const { createReminderRuntime, syncReminders } = await import("./reminderRuntime");

/** 2026-09-16 10:00 本地时间 */
const NOW = new Date(2026, 8, 16, 10, 0);

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "t1",
    title: "交周报",
    description: "",
    done: false,
    priority: "none",
    dueAt: "2026-09-16T18:00",
    remindAt: "2026-09-16T10:30",
    sortOrder: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function alerts() {
  return useReminderAlertStore.getState().items;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
    mocks.isMobile.mockReturnValue(false);
    mocks.isIos.mockReturnValue(false);
  mocks.isPermissionGranted.mockResolvedValue(true);
  mocks.pending.mockResolvedValue([]);
  useReminderAlertStore.setState({ items: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("syncReminders（桌面端：应用内定时 + 到点即时通知）", () => {
  it("未来提醒先挂定时器，到点才补卡片并发系统通知", async () => {
    const runtime = createReminderRuntime();
    const tasks = [task()];

    await syncReminders(runtime, tasks, { current: tasks });
    expect(alerts()).toHaveLength(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(runtime.timers.size).toBe(1);

    await vi.advanceTimersByTimeAsync(29 * 60 * 1000);
    expect(alerts()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0]).toMatchObject({ taskId: "t1", title: "交周报", dueLabel: "今天 18:00" });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification.mock.calls[0]?.[0]).toMatchObject({ title: "任务提醒：交周报", body: "截止 今天 18:00" });
    expect(runtime.timers.size).toBe(0);
  });

  it("启动时补发 24 小时内到期的提醒，同一次提醒只补一次", async () => {
    const runtime = createReminderRuntime();
    const tasks = [task({ remindAt: "2026-09-16T09:00" })];

    await syncReminders(runtime, tasks, { current: tasks });
    expect(alerts()).toHaveLength(1);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);

    // 用户手动关掉卡片后，看板再对账也不该再弹一次
    useReminderAlertStore.setState({ items: [] });
    await syncReminders(runtime, tasks, { current: tasks });
    expect(alerts()).toHaveLength(0);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("超过补发窗口的旧提醒不打扰，只留在待办分组里", async () => {
    const runtime = createReminderRuntime();
    const tasks = [task({ remindAt: "2026-09-14T09:00" })];

    await syncReminders(runtime, tasks, { current: tasks });
    expect(alerts()).toHaveLength(0);
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("多条同时到期合并成一条摘要通知", async () => {
    const runtime = createReminderRuntime();
    const tasks = [
      task({ id: "t1", remindAt: "2026-09-16T09:30" }),
      task({ id: "t2", title: "约牙医", remindAt: "2026-09-16T09:40" }),
    ];

    await syncReminders(runtime, tasks, { current: tasks });
    expect(alerts()).toHaveLength(2);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification.mock.calls[0]?.[0]).toMatchObject({
      title: "2 个待办到期",
      inboxLines: ["交周报 · 今天 18:00", "约牙医 · 今天 18:00"],
    });
  });
});

describe("syncReminders（桌面端：调度随任务变化重挂）", () => {
  it("任务完成后撤掉卡片，改提醒时刻会重挂定时器", async () => {
    const runtime = createReminderRuntime();
    const pending = task({ remindAt: "2026-09-16T10:30" });
    await syncReminders(runtime, [pending], { current: [pending] });

    const done = { ...pending, done: true };
    await syncReminders(runtime, [done], { current: [done] });
    expect(runtime.timers.size).toBe(0);

    const moved = task({ remindAt: "2026-09-16T12:00" });
    await syncReminders(runtime, [moved], { current: [moved] });
    expect(runtime.timers.size).toBe(1);
    expect(runtime.timers.get("t1")?.remindAt).toBe("2026-09-16T12:00");
  });
});

describe("syncReminders（移动端：交给 OS 预约）", () => {
  beforeEach(() => {
    mocks.isMobile.mockReturnValue(true);
  });

  it("未来提醒交给系统调度，并带上任务 id 与富文本内容", async () => {
    const runtime = createReminderRuntime();
    const tasks = [task({ priority: "high", description: "整理成本周进展三条" })];

    await syncReminders(runtime, tasks, { current: tasks });
    expect(runtime.timers.size).toBe(0);
    expect(alerts()).toHaveLength(0);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification.mock.calls[0]?.[0]).toMatchObject({
      title: "任务提醒：交周报",
      body: "截止 今天 18:00 · 高优先级",
      largeBody: "整理成本周进展三条",
      extra: { taskId: "t1" },
      schedule: expect.objectContaining({ at: expect.objectContaining({ date: new Date("2026-09-16T10:30") }) }),
    });
  });

  it("改提醒时刻会取消旧调度并重新预约", async () => {
    const runtime = createReminderRuntime();
    const first = task({ remindAt: "2026-09-16T10:30" });
    await syncReminders(runtime, [first], { current: [first] });

    const moved = task({ remindAt: "2026-09-16T11:30" });
    await syncReminders(runtime, [moved], { current: [moved] });

    expect(mocks.cancel).toHaveBeenCalledWith([expect.any(Number)]);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(runtime.scheduled.get("t1")?.remindAt).toBe("2026-09-16T11:30");
  });

  it("iOS 没有 big text 样式，说明摘要并入正文", async () => {
    mocks.isIos.mockReturnValue(true);
    const runtime = createReminderRuntime();
    const tasks = [task({ description: "整理成本周进展三条" })];

    await syncReminders(runtime, tasks, { current: tasks });

    expect(mocks.sendNotification.mock.calls[0]?.[0]).toMatchObject({
      body: "截止 今天 18:00\n整理成本周进展三条",
      largeBody: "整理成本周进展三条",
    });
  });
});
