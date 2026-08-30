import { describe, expect, it } from "vitest";
import type { SyncStatus } from "@/api/types";
import { deriveSyncLabel } from "./status";

function status(partial: Partial<SyncStatus>): SyncStatus {
  return { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false, ...partial };
}

describe("deriveSyncLabel", () => {
  it("冲突优先", () => {
    const label = deriveSyncLabel(status({ conflicted: true, ahead: 3 }), true);
    expect(label).toEqual({ text: "存在冲突", tone: "conflict" });
  });

  it("离线且有未同步内容", () => {
    const label = deriveSyncLabel(status({ ahead: 1, hasUncommitted: true }), false);
    expect(label).toEqual({ text: "离线待同步", tone: "offline" });
  });

  it("离线且无未同步内容", () => {
    expect(deriveSyncLabel(status({}), false)).toEqual({ text: "离线", tone: "offline" });
  });

  it("待推送", () => {
    expect(deriveSyncLabel(status({ ahead: 2 }), true)).toEqual({
      text: "待推送 2 个提交",
      tone: "pending",
    });
  });

  it("已同步", () => {
    expect(deriveSyncLabel(status({}), true)).toEqual({ text: "已同步", tone: "synced" });
  });
});
