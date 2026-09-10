import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloseConfirmDialog } from "./CloseConfirmDialog";

const listenMock = vi.hoisted(() => vi.fn());
const appApiMock = vi.hoisted(() => ({ confirmClose: vi.fn() }));

vi.mock("@/api/close-guard.api", () => ({
  onCloseRequested: listenMock,
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
  it("收到 close-requested 事件后展示确认框", async () => {
    render(<CloseConfirmDialog />);
    expect(screen.queryByText("有待提交的变更")).toBeNull();
    fireCloseRequested();
    expect(await screen.findByText("有待提交的变更")).toBeTruthy();
    expect(screen.getByText(/下次同步时自动提交/)).toBeTruthy();
  });

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
});
