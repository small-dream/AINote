import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui.store";
import { useVaultAutoLock } from "./useVaultAutoLock";

const queriesMock = vi.hoisted(() => ({
  useVaultStatusQuery: vi.fn(() => ({ data: { state: "locked" } })),
  useVaultLockMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ state: "locked", encryptedNotes: 1 }),
  })),
}));
const draftMock = vi.hoisted(() => ({
  flushPendingDrafts: vi.fn().mockResolvedValue(undefined),
}));
const toastMock = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/queries/vault.queries", () => queriesMock);
vi.mock("@/features/note/utils/draftRegistry", () => draftMock);
vi.mock("@/stores/toast.store", () => ({
  useToastStore: { getState: () => toastMock },
}));

const THIRTY_MINUTES = 30 * 60_000;

function setUnlocked(unlocked: boolean) {
  queriesMock.useVaultStatusQuery.mockReturnValue({ data: { state: unlocked ? "unlocked" : "locked" } });
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advanceAndSettle(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  draftMock.flushPendingDrafts.mockResolvedValue(undefined);
  queriesMock.useVaultLockMutation.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ state: "locked", encryptedNotes: 1 }),
  });
  useUiStore.setState({ vaultAutoLock: 30 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useVaultAutoLock 计时", () => {
  it("解锁态下空闲达到设置时长后自动锁定", async () => {
    setUnlocked(true);
    renderHook(() => useVaultAutoLock("/repo"));

    await advanceAndSettle(THIRTY_MINUTES - 1);
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();

    await advanceAndSettle(1);
    expect(queriesMock.useVaultLockMutation().mutateAsync).toHaveBeenCalled();
  });

  it("设置为「从不」时不会自动锁定", async () => {
    useUiStore.setState({ vaultAutoLock: 0 });
    setUnlocked(true);
    renderHook(() => useVaultAutoLock("/repo"));

    await advanceAndSettle(60 * 60_000);
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();
  });

  it("锁定态不启动计时器", async () => {
    setUnlocked(false);
    renderHook(() => useVaultAutoLock("/repo"));

    await advanceAndSettle(THIRTY_MINUTES);
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();
  });
});

describe("useVaultAutoLock 活动与可见性", () => {
  it("用户活动会重置空闲计时", async () => {
    setUnlocked(true);
    renderHook(() => useVaultAutoLock("/repo"));

    await advanceAndSettle(THIRTY_MINUTES - 1);
    await act(async () => {
      document.dispatchEvent(new Event("pointerdown"));
      vi.advanceTimersByTime(THIRTY_MINUTES - 1);
    });
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();

    await advanceAndSettle(1);
    expect(queriesMock.useVaultLockMutation().mutateAsync).toHaveBeenCalled();
  });

  it("窗口隐藏期间离开超过阈值，回到前台立即锁定（锁屏 / 睡眠补算）", async () => {
    setUnlocked(true);
    renderHook(() => useVaultAutoLock("/repo"));

    await act(async () => {
      setHidden(true);
      vi.advanceTimersByTime(THIRTY_MINUTES + 1);
    });
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();

    await act(async () => {
      setHidden(false);
    });
    expect(queriesMock.useVaultLockMutation().mutateAsync).toHaveBeenCalled();
  });

  it("窗口隐藏不足阈值时按剩余时间继续计时", async () => {
    setUnlocked(true);
    renderHook(() => useVaultAutoLock("/repo"));

    await act(async () => {
      setHidden(true);
      vi.advanceTimersByTime(THIRTY_MINUTES - 2);
    });
    await act(async () => {
      setHidden(false);
      vi.advanceTimersByTime(1);
    });
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();

    await advanceAndSettle(1);
    expect(queriesMock.useVaultLockMutation().mutateAsync).toHaveBeenCalled();
  });
});

describe("useVaultAutoLock 失败处理", () => {
  it("落盘失败时报错并重新计时，不锁定", async () => {
    setUnlocked(true);
    draftMock.flushPendingDrafts.mockRejectedValue(new Error("disk full"));
    renderHook(() => useVaultAutoLock("/repo"));

    await advanceAndSettle(THIRTY_MINUTES);
    expect(queriesMock.useVaultLockMutation().mutateAsync).not.toHaveBeenCalled();
    expect(toastMock.push).toHaveBeenCalledWith(expect.stringContaining("disk full"), "error");

    await advanceAndSettle(THIRTY_MINUTES);
    expect(toastMock.push).toHaveBeenCalledTimes(2);
  });
});
