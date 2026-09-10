import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setDraftDirty: vi.fn(() => Promise.resolve()),
  isTauriRuntime: vi.fn(() => true),
}));

vi.mock("@/api/close-guard.api", () => ({ setDraftDirty: mocks.setDraftDirty }));
vi.mock("@/api/back-button.api", () => ({ isTauriRuntime: mocks.isTauriRuntime }));

/** 每次取一份全新的模块状态，避免模块级登记表在用例之间串味。 */
async function loadRegistry() {
  vi.resetModules();
  return await import("./draftRegistry");
}

beforeEach(() => {
  mocks.setDraftDirty.mockClear();
  mocks.setDraftDirty.mockImplementation(() => Promise.resolve());
  mocks.isTauriRuntime.mockReset();
  mocks.isTauriRuntime.mockReturnValue(true);
});

describe("draftRegistry", () => {
  it("按登记项聚合未落盘草稿，注销后归零", async () => {
    const { hasPendingDraft, registerDraft } = await loadRegistry();
    let dirty = false;
    const unregister = registerDraft({ flush: async () => { dirty = false; }, isDirty: () => dirty });

    expect(hasPendingDraft()).toBe(false);
    dirty = true;
    expect(hasPendingDraft()).toBe(true);
    unregister();
    expect(hasPendingDraft()).toBe(false);
  });

  it("flushPendingDrafts 只写脏草稿，并把脏状态落干净", async () => {
    const { flushPendingDrafts, hasPendingDraft, registerDraft } = await loadRegistry();
    const flushed: string[] = [];
    const clean = false;
    let dirty = true;
    registerDraft({ flush: async () => { flushed.push("clean"); }, isDirty: () => clean });
    registerDraft({ flush: async () => { flushed.push("dirty"); dirty = false; }, isDirty: () => dirty });

    await flushPendingDrafts();

    expect(flushed).toEqual(["dirty"]);
    expect(hasPendingDraft()).toBe(false);
  });

  it("flush 失败时抛出，调用方据此中止离开流程", async () => {
    const { flushPendingDrafts, registerDraft } = await loadRegistry();
    const second = vi.fn(async () => undefined);
    registerDraft({ flush: async () => { throw new Error("disk full"); }, isDirty: () => true });
    registerDraft({ flush: second, isDirty: () => true });

    await expect(flushPendingDrafts()).rejects.toThrow("disk full");
  });

  it("草稿状态变化时上报 Rust，相同状态不重复上报", async () => {
    const { flushPendingDrafts, publishDraftState, registerDraft } = await loadRegistry();
    let dirty = true;
    registerDraft({ flush: async () => { dirty = false; }, isDirty: () => dirty });
    expect(mocks.setDraftDirty).toHaveBeenCalledWith(true);

    publishDraftState();
    expect(mocks.setDraftDirty).toHaveBeenCalledTimes(1);

    await flushPendingDrafts();
    publishDraftState();
    expect(mocks.setDraftDirty).toHaveBeenLastCalledWith(false);
  });

  it("非 Tauri 环境只维护本地状态，不发起 IPC", async () => {
    const { flushPendingDrafts, registerDraft } = await loadRegistry();
    mocks.isTauriRuntime.mockReturnValue(false);
    let dirty = true;
    registerDraft({ flush: async () => { dirty = false; }, isDirty: () => dirty });

    await flushPendingDrafts();

    expect(mocks.setDraftDirty).not.toHaveBeenCalled();
  });

  it("上报失败不阻塞交互，下一次状态变化会重试", async () => {
    const { publishDraftState, registerDraft } = await loadRegistry();
    mocks.setDraftDirty.mockRejectedValueOnce(new Error("offline"));
    let dirty = true;
    registerDraft({ flush: async () => undefined, isDirty: () => dirty });

    await Promise.resolve();
    dirty = false;
    publishDraftState();

    expect(mocks.setDraftDirty).toHaveBeenLastCalledWith(false);
  });
});
