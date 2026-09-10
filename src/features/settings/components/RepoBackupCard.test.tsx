import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackupExportDto, BackupProgress } from "@/api";
import { RepoBackupCard } from "./RepoBackupCard";

const repoApiMock = vi.hoisted(() => ({
  exportBackup: vi.fn(),
  cancelBackup: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/api", () => ({ repoApi: repoApiMock }));

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoBackupCard />
    </QueryClientProvider>
  );
}

describe("RepoBackupCard 导出结果", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repoApiMock.cancelBackup.mockResolvedValue(null);
  });

  it("导出成功后显示大小与文件数", async () => {
    repoApiMock.exportBackup.mockResolvedValue({
      path: "/tmp/backup.zip",
      bytes: 1536,
      fileCount: 2,
      totalBytes: 1024,
    });
    renderCard();

    fireEvent.click(screen.getByText("导出整库备份"));
    expect(await screen.findByText("已导出 1.5 KB，共 2 个文件。")).toBeTruthy();
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it("用户取消保存时提示已取消", async () => {
    repoApiMock.exportBackup.mockResolvedValue(null);
    renderCard();

    fireEvent.click(screen.getByText("导出整库备份"));
    expect(await screen.findByText("已取消备份，未生成文件。")).toBeTruthy();
  });

  it("失败时给出磁盘空间提示", async () => {
    repoApiMock.exportBackup.mockRejectedValue(new Error("no space"));
    renderCard();

    fireEvent.click(screen.getByText("导出整库备份"));
    expect(await screen.findByText("备份失败，请检查磁盘空间后重试。")).toBeTruthy();
  });
});

describe("RepoBackupCard 进度与选项", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    repoApiMock.cancelBackup.mockResolvedValue(null);
  });

  it("进行中显示进度并可取消", async () => {
    let resolveExport: (value: BackupExportDto | null) => void = () => {};
    repoApiMock.exportBackup.mockImplementation(
      (_exclude: boolean, onProgress: (progress: BackupProgress) => void) => {
        onProgress({ phase: "writing", processed: 25, total: 100 });
        return new Promise<BackupExportDto | null>((resolve) => {
          resolveExport = resolve;
        });
      }
    );
    renderCard();

    fireEvent.click(screen.getByText("导出整库备份"));
    expect(await screen.findByText("正在写入 25/100 个文件…")).toBeTruthy();

    fireEvent.click(screen.getByText("取消"));
    expect(repoApiMock.cancelBackup).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExport(null);
    });
    expect(await screen.findByText("已取消备份，未生成文件。")).toBeTruthy();
  });

  it("勾选排除 assets 时透传选项", async () => {
    repoApiMock.exportBackup.mockResolvedValue(null);
    renderCard();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("导出整库备份"));
    await waitFor(() => expect(repoApiMock.exportBackup).toHaveBeenCalledWith(true, expect.any(Function)));
  });
});
