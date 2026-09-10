import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/error";
import type { SyncController } from "../hooks/useSync";
import { SyncFailureNotice } from "./SyncFailureNotice";

const supportApiMock = vi.hoisted(() => ({ exportDiagnostics: vi.fn() }));
vi.mock("@/api", () => ({ supportApi: supportApiMock }));

const NETWORK_ERROR: AppError = {
  code: "SYNC_4002",
  kind: "network",
  message: "连接超时",
  retriable: true,
};

function controller(error: unknown, mutate = vi.fn()): SyncController {
  return {
    online: true,
    status: { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false },
    label: { text: "已同步", tone: "synced" },
    syncNow: { error, mutate, isPending: false },
    resolve: { isPending: false },
    checkpoint: { isPending: false },
    isSyncing: false,
    resolving: false,
    committing: false,
  } as unknown as SyncController;
}

describe("SyncFailureNotice", () => {
  it("无失败时不渲染任何内容", () => {
    const { container } = render(<SyncFailureNotice sync={controller(null)} />);
    expect(container.firstChild).toBeNull();
  });

  it("网络失败展示阶段、原因、建议与重试", () => {
    render(<SyncFailureNotice sync={controller(NETWORK_ERROR)} />);
    expect(screen.getByRole("alert").textContent).toContain("同步失败 · 拉取 / 推送阶段");
    expect(screen.getByText("连接超时")).toBeTruthy();
    expect(screen.getByText("网络连接异常，请检查网络后重试")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试同步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导出诊断包" })).toBeTruthy();
  });

  it("点击重试触发同步", () => {
    const mutate = vi.fn();
    render(<SyncFailureNotice sync={controller(NETWORK_ERROR, mutate)} />);
    fireEvent.click(screen.getByRole("button", { name: "重试同步" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("凭证失效时改为引导重新登录", () => {
    render(
      <SyncFailureNotice
        sync={controller({ code: "SYNC_4003", kind: "auth", message: "401", retriable: false })}
      />,
    );
    expect(screen.getByRole("button", { name: "重新登录" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重试同步" })).toBeNull();
    expect(screen.getByText("登录凭证已失效，请重新登录 GitHub")).toBeTruthy();
  });

  it("导出诊断包走 IPC 并反馈结果", async () => {
    supportApiMock.exportDiagnostics.mockResolvedValue({ path: "/tmp/a.zip", bytes: 1, files: [] });
    render(<SyncFailureNotice sync={controller(NETWORK_ERROR)} />);
    fireEvent.click(screen.getByRole("button", { name: "导出诊断包" }));
    await waitFor(() => expect(supportApiMock.exportDiagnostics).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("已导出")).toBeTruthy();
  });
});
