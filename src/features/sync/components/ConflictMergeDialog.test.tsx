import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictMergeDialog } from "./ConflictMergeDialog";

const syncApiMock = vi.hoisted(() => ({
  conflicts: vi.fn(),
  resolveFile: vi.fn(),
  push: vi.fn(),
  resolveConflict: vi.fn(),
  exportConflicts: vi.fn(),
  status: vi.fn(),
  commit: vi.fn(),
  pull: vi.fn(),
  syncNow: vi.fn(),
}));
vi.mock("@/api", () => ({ syncApi: syncApiMock }));

const FILE = { path: "daily/a.md", local: "本地行1\n本地行2", remote: "远端行1" };
const ENCRYPTED_FILE = {
  path: "daily/secret.md",
  local: "AINOTE-ENC-v1\nTE9DQUw=\n",
  remote: "AINOTE-ENC-v1\nUkVNT1RF\n",
};
const STATUS = { ahead: 0, behind: 0, hasUncommitted: false, conflicted: false };

/** 让 useIsMobileViewport 判定为移动端（jsdom 默认没有 matchMedia） */
function stubMobileViewport(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ConflictMergeDialog repoPath="/repo" open onClose={onClose} />
    </QueryClientProvider>
  );
  return { onClose };
}

beforeEach(() => {
  vi.resetAllMocks();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("ConflictMergeDialog", () => {
  it("加密笔记不渲染三栏，改为二选一并原样写回选定的一侧（E5）", async () => {
    syncApiMock.conflicts.mockResolvedValue([ENCRYPTED_FILE]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    renderDialog();

    expect(await screen.findByText("这篇笔记已加密")).toBeTruthy();
    expect(screen.queryByLabelText("合并结果")).toBeNull();
    expect(screen.queryByText("本地行1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "保留远端" }));
    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/secret.md", ENCRYPTED_FILE.remote);
    });
  });

  it("展示本地/远端/合并三栏与文件 tab", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    renderDialog();

    expect(await screen.findByText("本地行1")).toBeTruthy();
    expect(screen.getByText("远端行1")).toBeTruthy();
    expect(screen.getByText("daily/a.md")).toBeTruthy();
    expect(screen.getByLabelText("合并结果")).toBeTruthy();
  });

  it("点击本地行追加到合并结果并保存", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    renderDialog();

    const firstLine = await screen.findByText("本地行1");
    fireEvent.click(firstLine);

    const textarea = screen.getByLabelText("合并结果") as HTMLTextAreaElement;
    expect(textarea.value).toBe("本地行1\n本地行2\n本地行1");
    fireEvent.click(screen.getByText("保存合并"));
    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "本地行1\n本地行2\n本地行1");
    });
  });
});

describe("ConflictMergeDialog 一步解决与失败反馈", () => {
  it("点「保留远端」立即写回远端内容（一步完成，不需再点保存）", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    renderDialog();

    await screen.findByText("本地行1");
    fireEvent.click(screen.getByRole("button", { name: "保留远端" }));

    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "远端行1");
    });
  });

  it("解决失败时回显原因与重试入口，不再静默无反应", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockRejectedValue({ code: "IO_5001", kind: "io", message: "磁盘写入失败", retriable: true });
    renderDialog();

    await screen.findByText("本地行1");
    fireEvent.click(screen.getByRole("button", { name: "保留远端" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("冲突处理失败")).toBeTruthy();
    expect(within(alert).getByText("磁盘写入失败")).toBeTruthy();
    expect(within(alert).getByRole("button", { name: "重试" })).toBeTruthy();
  });

  it("没有冲突文件时给出收尾入口，而不是一块点不动的空白", async () => {
    syncApiMock.conflicts.mockResolvedValue([]);
    syncApiMock.resolveConflict.mockResolvedValue(STATUS);
    const { onClose } = renderDialog();

    expect(await screen.findByText("没有待处理的冲突文件")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "完成合并并推送" }));

    await waitFor(() => {
      expect(syncApiMock.resolveConflict).toHaveBeenCalledWith(true);
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe("ConflictMergeDialog 加载失败", () => {
  it("读取冲突文件失败时给出原因与重试，重试后恢复列表", async () => {
    syncApiMock.conflicts.mockRejectedValueOnce({ code: "REPO_3001", kind: "notFound", message: "未绑定仓库", retriable: false });
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    renderDialog();

    expect(await screen.findByText("读取冲突文件失败")).toBeTruthy();
    expect(screen.getByText(/未绑定仓库/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("本地行1")).toBeTruthy();
  });

  it("关闭时不渲染", () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ConflictMergeDialog repoPath="/repo" open={false} onClose={vi.fn()} />
      </QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("ConflictMergeDialog 移动端单栏", () => {
  it("三栏折成分页签，一次只看一栏且底部操作条始终可用", async () => {
    stubMobileViewport();
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveFile.mockResolvedValue(STATUS);
    renderDialog();

    const tabs = await screen.findByRole("tablist", { name: "冲突内容面板" });
    expect(within(tabs).getByRole("tab", { name: "本地" })).toBeTruthy();
    // 默认停在「合并结果」，本地/远端的行列表不占屏
    expect(screen.getByLabelText("合并结果")).toBeTruthy();
    expect(screen.queryByText("远端行1")).toBeNull();

    fireEvent.click(within(tabs).getByRole("tab", { name: "远端" }));
    expect(screen.getByText("远端行1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "保留远端" }));
    await waitFor(() => {
      expect(syncApiMock.resolveFile).toHaveBeenCalledWith("daily/a.md", "远端行1");
    });
  });

  it("批量解决按钮在移动端也保持可点，失败时有反馈", async () => {
    stubMobileViewport();
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.resolveConflict.mockRejectedValue({ code: "SYNC_4002", kind: "network", message: "网络不可达", retriable: true });
    renderDialog();

    await screen.findByText("全部使用远端");
    fireEvent.click(screen.getByRole("button", { name: "全部使用远端" }));

    await waitFor(() => expect(syncApiMock.resolveConflict).toHaveBeenCalledWith(false));
    expect(await screen.findByText("网络不可达")).toBeTruthy();
  });
});

describe("ConflictMergeDialog 导出兜底", () => {
  it("提供「导出冲突文件」兜底并回显保存位置", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.exportConflicts.mockResolvedValue({
      path: "/tmp/ainote-conflicts.zip",
      bytes: 128,
      files: ["local/daily/a.md", "remote/daily/a.md"],
    });
    renderDialog();

    const button = await screen.findByRole("button", { name: "导出冲突文件" });
    fireEvent.click(button);
    await waitFor(() => expect(syncApiMock.exportConflicts).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "已导出冲突文件" })).toBeTruthy();
    expect(screen.getByTitle("/tmp/ainote-conflicts.zip")).toBeTruthy();
  });

  it("导出失败时提示重试", async () => {
    syncApiMock.conflicts.mockResolvedValue([FILE]);
    syncApiMock.exportConflicts.mockRejectedValue(new Error("disk full"));
    renderDialog();

    fireEvent.click(await screen.findByRole("button", { name: "导出冲突文件" }));
    expect(await screen.findByRole("button", { name: "导出失败，请重试" })).toBeTruthy();
  });
});
