import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportToastError, useToastStore } from "./toast.store";

beforeEach(() => {
  useToastStore.getState().clear();
});

afterEach(() => {
  vi.useRealTimers();
  useToastStore.getState().clear();
});

describe("toast.store 推送与关闭", () => {
  it("push 默认 error 语气并追加到队列尾部", () => {
    useToastStore.getState().push("同步失败", undefined, 0);
    useToastStore.getState().push("已保存", "success", 0);

    const items = useToastStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ tone: "error", message: "同步失败" });
    expect(items[1]).toMatchObject({ tone: "success", message: "已保存" });
    expect(new Set(items.map((item) => item.id)).size).toBe(2);
  });

  it("容量超过 5 条时丢弃最早的（slice(-4) 截断）", () => {
    for (let i = 1; i <= 7; i += 1) {
      useToastStore.getState().push(`消息-${i}`, "info", 0);
    }

    const items = useToastStore.getState().items;
    expect(items).toHaveLength(5);
    expect(items.map((item) => item.message)).toEqual(["消息-3", "消息-4", "消息-5", "消息-6", "消息-7"]);
  });

  it("dismiss 只移除指定条目，clear 清空全部", () => {
    useToastStore.getState().push("甲", "info", 0);
    useToastStore.getState().push("乙", "info", 0);
    const [first, second] = useToastStore.getState().items.map((item) => item.id);
    if (first === undefined || second === undefined) throw new Error("toast id 缺失");

    useToastStore.getState().dismiss(first);
    expect(useToastStore.getState().items.map((item) => item.id)).toEqual([second]);

    useToastStore.getState().clear();
    expect(useToastStore.getState().items).toEqual([]);
  });
});

describe("toast.store 自动消失", () => {
  it("到达 durationMs 后自动移除对应条目", () => {
    vi.useFakeTimers();
    useToastStore.getState().push("短时提示", "info", 1000);
    const [id] = useToastStore.getState().items.map((item) => item.id);
    if (id === undefined) throw new Error("toast id 缺失");

    vi.advanceTimersByTime(999);
    expect(useToastStore.getState().items.map((item) => item.id)).toEqual([id]);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().items).toEqual([]);
  });

  it("默认 6000ms 自动消失，且只移除到期的条目", () => {
    vi.useFakeTimers();
    useToastStore.getState().push("默认时长");
    vi.advanceTimersByTime(3000);
    useToastStore.getState().push("后加入", "info", 10000);

    vi.advanceTimersByTime(3000);
    expect(useToastStore.getState().items.map((item) => item.message)).toEqual(["后加入"]);

    vi.advanceTimersByTime(7000);
    expect(useToastStore.getState().items).toEqual([]);
  });

  it("durationMs 为 0 时不自动消失", () => {
    vi.useFakeTimers();
    useToastStore.getState().push("常驻", "error", 0);

    vi.advanceTimersByTime(60_000);
    expect(useToastStore.getState().items).toHaveLength(1);
  });
});

describe("reportToastError", () => {
  it("普通 Error 以 error 语气推入统一错误中心", () => {
    reportToastError(new Error("网络超时"));

    const items = useToastStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tone: "error", message: "网络超时" });
  });
});
