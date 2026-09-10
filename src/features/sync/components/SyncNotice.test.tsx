import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/error";
import type { SyncController } from "../hooks/useSync";
import { SyncNotice } from "./SyncNotice";

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
    retry: null,
    cancelRetry: vi.fn(),
    resolving: false,
    committing: false,
  } as unknown as SyncController;
}

function retryingController(retry: { retry: number; maxRetries: number; delayMs: number }) {
  return {
    ...controller(null),
    retry,
    cancelRetry: vi.fn(),
  } as unknown as SyncController;
}

describe("SyncNotice", () => {
  it("无失败时不渲染任何内容", () => {
    const { container } = render(<SyncNotice sync={controller(null)} />);
    expect(container.firstChild).toBeNull();
  });

  it("网络失败展示阶段、原因、建议与重试", () => {
    render(<SyncNotice sync={controller(NETWORK_ERROR)} />);
    expect(screen.getByRole("alert").textContent).toContain("同步失败 · 拉取 / 推送阶段");
    expect(screen.getByText("连接超时")).toBeTruthy();
    expect(screen.getByText("网络连接异常，请检查网络后重试")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试同步" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导出诊断包" })).toBeTruthy();
  });

  it("点击重试触发同步", () => {
    const mutate = vi.fn();
    render(<SyncNotice sync={controller(NETWORK_ERROR, mutate)} />);
    fireEvent.click(screen.getByRole("button", { name: "重试同步" }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("凭证失效时改为引导重新登录", () => {
    render(
      <SyncNotice
        sync={controller({ code: "SYNC_4003", kind: "auth", message: "401", retriable: false })}
      />,
    );
    expect(screen.getByRole("button", { name: "重新登录" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "重试同步" })).toBeNull();
    expect(screen.getByText("登录凭证已失效，请重新登录 GitHub")).toBeTruthy();
  });

  it("导出诊断包走 IPC 并反馈结果", async () => {
    supportApiMock.exportDiagnostics.mockResolvedValue({ path: "/tmp/a.zip", bytes: 1, files: [] });
    render(<SyncNotice sync={controller(NETWORK_ERROR)} />);
    fireEvent.click(screen.getByRole("button", { name: "导出诊断包" }));
    await waitFor(() => expect(supportApiMock.exportDiagnostics).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("已导出")).toBeTruthy();
  });

  it("自动重试中显示进度与取消入口", () => {
    render(<SyncNotice sync={retryingController({ retry: 2, maxRetries: 3, delayMs: 2000 })} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("重试中（2/3）");
    expect(status.textContent).toContain("2 秒后自动重试");
    expect(screen.getByRole("button", { name: "取消重试" })).toBeTruthy();
  });

  it("点击取消重试调用取消入口", () => {
    const sync = retryingController({ retry: 1, maxRetries: 3, delayMs: 500 });
    render(<SyncNotice sync={sync} />);
    fireEvent.click(screen.getByRole("button", { name: "取消重试" }));
    expect(sync.cancelRetry).toHaveBeenCalledTimes(1);
  });

  it("重试中优先显示进度，不再显示旧的失败横幅", () => {
    const sync = {
      ...retryingController({ retry: 1, maxRetries: 3, delayMs: 500 }),
      syncNow: { error: NETWORK_ERROR, mutate: vi.fn(), isPending: true },
    } as unknown as SyncController;
    render(<SyncNotice sync={sync} />);
    expect(screen.queryByRole("button", { name: "重试同步" })).toBeNull();
    expect(screen.getByRole("button", { name: "取消重试" })).toBeTruthy();
  });
});
