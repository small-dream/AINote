import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloseConfirmDialog } from "./CloseConfirmDialog";
import { registerDraft } from "@/features/note/utils/draftRegistry";

const listenMock = vi.hoisted(() => vi.fn());
const appApiMock = vi.hoisted(() => ({ confirmClose: vi.fn() }));
const setDraftDirtyMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/api/close-guard.api", () => ({
  onCloseRequested: listenMock,
  setDraftDirty: setDraftDirtyMock,
}));

vi.mock("@/api/back-button.api", () => ({
  isTauriRuntime: () => true,
}));

vi.mock("@/api/app.api", () => appApiMock);

beforeEach(() => {
  listenMock.mockImplementation(() => Promise.resolve(() => undefined));
  appApiMock.confirmClose.mockResolvedValue(undefined);
  listenMock.mockClear();
  appApiMock.confirmClose.mockClear();
});

function fireCloseRequested() {
  const handler = listenMock.mock.calls[0]?.[0];
  expect(handler).toBeTypeOf("function");
  act(() => handler());
}

describe("CloseConfirmDialog", () => {
  it("确认退出前先落盘未保存草稿", async () => {
    let dirty = true;
    const flush = vi.fn(async () => { dirty = false; });
    const unregister = registerDraft({ flush, isDirty: () => dirty });
    try {
      render(<CloseConfirmDialog />);
      fireCloseRequested();
      fireEvent.click(await screen.findByRole("button", { name: "确认退出" }));

      await waitFor(() => expect(flush).toHaveBeenCalled());
      await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalled());
      expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
        appApiMock.confirmClose.mock.invocationCallOrder[0] ?? 0,
      );
    } finally {
      unregister();
    }
  });

  it("落盘失败时留在应用内，不关闭窗口", async () => {
    const unregister = registerDraft({
      flush: async () => { throw new Error("disk full"); },
      isDirty: () => true,
    });
    try {
      render(<CloseConfirmDialog />);
      fireCloseRequested();
      fireEvent.click(await screen.findByRole("button", { name: "确认退出" }));

      await waitFor(() => expect(screen.getByText("有待提交的变更")).toBeTruthy());
      expect(appApiMock.confirmClose).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it("收到 close-requested 事件后展示确认框", async () => {
    render(<CloseConfirmDialog />);
    expect(screen.queryByText("有待提交的变更")).toBeNull();
    fireCloseRequested();
    expect(await screen.findByText("有待提交的变更")).toBeTruthy();
    expect(screen.getByText(/下次同步时自动提交/)).toBeTruthy();
  });
});

describe("CloseConfirmDialog 确认与重试", () => {
  it("确认退出时调用 confirmClose", async () => {
    render(<CloseConfirmDialog />);
    fireCloseRequested();
    fireEvent.click(await screen.findByRole("button", { name: "确认退出" }));
    await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalled());
  });

  it("取消时不调用 confirmClose 并关闭确认框", async () => {
    render(<CloseConfirmDialog />);
    fireCloseRequested();
    fireEvent.click(await screen.findByRole("button", { name: "取消" }));
    expect(appApiMock.confirmClose).not.toHaveBeenCalled();
    expect(screen.queryByText("有待提交的变更")).toBeNull();
  });

  describe("确认退出失败与重试", () => {
    it("confirmClose 失败后确认按钮可重试，不会一次性死亡", async () => {
      appApiMock.confirmClose.mockRejectedValueOnce(new Error("close rejected"));
      render(<CloseConfirmDialog />);
      fireCloseRequested();
      fireEvent.click(await screen.findByRole("button", { name: "确认退出" }));
      await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalledTimes(1));

      // 失败复位后再次确认：走完整 flush → confirmClose 流程并成功退出
      fireEvent.click(screen.getByRole("button", { name: "确认退出" }));
      await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalledTimes(2));
    });

    it("关闭流程进行中重复确认被忽略，不重复调用 confirmClose", async () => {
      let release: () => void = () => undefined;
      appApiMock.confirmClose.mockImplementationOnce(
        () => new Promise<void>((resolve) => { release = resolve; }),
      );
      render(<CloseConfirmDialog />);
      fireCloseRequested();
      const button = await screen.findByRole("button", { name: "确认退出" });
      fireEvent.click(button);
      fireEvent.click(button);
      await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalledTimes(1));

      release();
      await waitFor(() => expect(appApiMock.confirmClose).toHaveBeenCalledTimes(1));
    });
  });
});
