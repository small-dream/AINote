import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskDraft } from "../utils/taskDraft";
import { useTaskDraftSync } from "./useTaskDraftSync";

const draft: TaskDraft = { title: "写周报", description: "", dueAt: null, priority: "none", remindAt: null };

function setup(commit: (next: TaskDraft) => Promise<void>) {
  return renderHook(() => useTaskDraftSync({ commit }));
}

describe("useTaskDraftSync", () => {
  it("提交成功后进入已保存，并把标题按提交口径归一", async () => {
    const commit = vi.fn(async () => {});
    const { result } = setup(commit);

    await act(async () => { await result.current.flush({ ...draft, title: "  写周报  " }); });

    expect(commit).toHaveBeenCalledWith(draft);
    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("提交失败时保留失败原因，flush 返回 false", async () => {
    const commit = vi.fn(async () => { throw new Error("磁盘已满"); });
    const { result } = setup(commit);

    let ok = true;
    await act(async () => { ok = await result.current.flush(draft); });

    expect(ok).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("磁盘已满");
  });

  it("同步抛错也收敛成失败状态，不会漏出未处理的异常", async () => {
    const commit = vi.fn(() => { throw new Error("IPC 不可用"); }) as unknown as (next: TaskDraft) => Promise<void>;
    const { result } = setup(commit);

    await act(async () => { await result.current.flush(draft); });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("IPC 不可用");
  });

  it("并发 flush 串行化，后一份草稿等前一份写完之后才发", async () => {
    const order: string[] = [];
    let release: (() => void) | null = null;
    const commit = vi.fn(async (next: TaskDraft) => {
      order.push(`start:${next.title}`);
      if (next.title === "第一版") await new Promise<void>((resolve) => { release = resolve; });
      order.push(`end:${next.title}`);
    });
    const { result } = setup(commit);

    let second: Promise<boolean> | null = null;
    await act(async () => {
      void result.current.flush({ ...draft, title: "第一版" });
      second = result.current.flush({ ...draft, title: "第二版" });
      await Promise.resolve();
    });
    expect(order).toEqual(["start:第一版"]);

    await act(async () => { release?.(); await second; });
    expect(order).toEqual(["start:第一版", "end:第一版", "start:第二版", "end:第二版"]);
  });

  it("自动保存不重试同一份失败草稿，草稿变了才恢复", async () => {
    const commit = vi.fn(async () => { throw new Error("写盘失败"); });
    const { result } = setup(commit);

    await act(async () => { await result.current.autoFlush(draft); });
    expect(commit).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.autoFlush(draft); });
    expect(commit).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.autoFlush({ ...draft, title: "交周报" }); });
    expect(commit).toHaveBeenCalledTimes(2);
  });
});

describe("useTaskDraftSync 去重", () => {
  it("同一份草稿在途时再次 flush 复用结果，不把内容写第二遍", async () => {
    let release: (() => void) | null = null;
    const commit = vi.fn(async () => { await new Promise<void>((resolve) => { release = resolve; }); });
    const { result } = setup(commit);

    let followUp: Promise<boolean> | null = null;
    await act(async () => {
      void result.current.flush(draft);
      await Promise.resolve();
      followUp = result.current.flush({ ...draft, title: "  写周报  " });
    });
    expect(commit).toHaveBeenCalledTimes(1);

    await act(async () => { release?.(); await followUp; });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("saved");
  });
});

describe("useTaskDraftSync 显式重试", () => {
  it("显式 flush 始终重试，不受自动保存抑制影响", async () => {
    const commit = vi.fn(async () => { throw new Error("写盘失败"); });
    const { result } = setup(commit);

    await act(async () => { await result.current.autoFlush(draft); });
    await act(async () => { await result.current.flush(draft); });

    expect(commit).toHaveBeenCalledTimes(2);
  });
});
