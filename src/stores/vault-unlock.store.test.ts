import { beforeEach, describe, expect, it } from "vitest";
import { useVaultUnlockStore } from "./vault-unlock.store";

describe("vault-unlock 自动触发闸门", () => {
  beforeEach(() => {
    useVaultUnlockStore.setState({ suppressed: false, spent: false });
  });

  it("默认允许一次自动触发，用掉后不再重复", () => {
    expect(useVaultUnlockStore.getState().consumeAuto()).toBe(true);
    expect(useVaultUnlockStore.getState().consumeAuto()).toBe(false);
  });

  it("用户主动锁定后抑制自动触发，重新 arm 才恢复", () => {
    useVaultUnlockStore.getState().suppress();
    expect(useVaultUnlockStore.getState().consumeAuto()).toBe(false);

    useVaultUnlockStore.getState().arm();
    expect(useVaultUnlockStore.getState().consumeAuto()).toBe(true);
  });

  it("arm 同时清掉「已触发过」，让新一次锁定周期能再弹一次", () => {
    useVaultUnlockStore.getState().consumeAuto();
    useVaultUnlockStore.getState().arm();
    expect(useVaultUnlockStore.getState().consumeAuto()).toBe(true);
  });

  it("解锁成功 arm 后，主动锁定的抑制状态不会残留", () => {
    useVaultUnlockStore.getState().suppress();
    useVaultUnlockStore.getState().arm();
    expect(useVaultUnlockStore.getState().suppressed).toBe(false);
    expect(useVaultUnlockStore.getState().spent).toBe(false);
  });
});
