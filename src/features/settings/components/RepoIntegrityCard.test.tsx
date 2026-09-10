import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepoIntegrityCard } from "./RepoIntegrityCard";

const repoApiMock = vi.hoisted(() => ({ integrity: vi.fn() }));
vi.mock("@/api", () => ({ repoApi: repoApiMock }));

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RepoIntegrityCard />
    </QueryClientProvider>
  );
}

describe("RepoIntegrityCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("健康仓库显示未发现问题", async () => {
    repoApiMock.integrity.mockResolvedValue({ ok: true, issues: [] });
    renderCard();

    fireEvent.click(screen.getByText("检查完整性"));
    expect(await screen.findByText("未发现问题，仓库状态正常。")).toBeTruthy();
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it("损坏仓库展示错误码与修复建议", async () => {
    repoApiMock.integrity.mockResolvedValue({
      ok: false,
      issues: [
        { code: "REPO_3102", severity: "error", message: "Git 对象损坏或缺失", fixHint: "从备份恢复或重新克隆" },
      ],
    });
    renderCard();

    fireEvent.click(screen.getByText("检查完整性"));
    expect(await screen.findByText(/发现 1 个需要处理的问题/)).toBeTruthy();
    expect(screen.getByText(/REPO_3102/)).toBeTruthy();
    expect(screen.getByText("Git 对象损坏或缺失")).toBeTruthy();
    expect(screen.getByText("建议：从备份恢复或重新克隆")).toBeTruthy();
  });

  it("仅有提示时仍显示问题列表", async () => {
    repoApiMock.integrity.mockResolvedValue({
      ok: true,
      issues: [
        { code: "REPO_3104", severity: "warning", message: "未配置 origin 远端", fixHint: "重新绑定仓库" },
      ],
    });
    renderCard();

    fireEvent.click(screen.getByText("检查完整性"));
    expect(await screen.findByText(/以下为 1 条提示/)).toBeTruthy();
    expect(screen.getByText(/REPO_3104/)).toBeTruthy();
  });

  it("检查失败可重试", async () => {
    repoApiMock.integrity.mockRejectedValue(new Error("boom"));
    renderCard();

    fireEvent.click(screen.getByText("检查完整性"));
    expect(await screen.findByText("检查失败，请重试。")).toBeTruthy();

    repoApiMock.integrity.mockResolvedValue({ ok: true, issues: [] });
    fireEvent.click(screen.getByText("重试"));
    expect(await screen.findByText("未发现问题，仓库状态正常。")).toBeTruthy();
  });
});
