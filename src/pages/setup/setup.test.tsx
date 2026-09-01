import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupPage } from "./index";

const authApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  validateToken: vi.fn(),
  saveToken: vi.fn(),
}));

const repoApiMock = vi.hoisted(() => ({
  bind: vi.fn(),
  create: vi.fn(),
  validate: vi.fn(),
  path: vi.fn(),
}));

vi.mock("@/api", () => ({
  authApi: authApiMock,
  repoApi: repoApiMock,
  isAppError: () => false,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

function renderSetup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/setup"]}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/workspace" element={<div>workspace-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function loginThrough() {
  const input = await screen.findByPlaceholderText("ghp_...");
  fireEvent.change(input, { target: { value: "ghp_x" } });
  fireEvent.click(screen.getByText("校验 Token"));
  await screen.findByText("small-dream");
  fireEvent.click(screen.getByText("确认并继续"));
}

describe("SetupPage 登录并保存 Token", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authApiMock.status.mockResolvedValue({ hasToken: false, repoPath: null });
  });

  it("允许从页面顶部空白区域拖动窗口", () => {
    const { container } = renderSetup();

    expect(container.firstElementChild?.hasAttribute("data-tauri-drag-region")).toBe(true);
  });

  it("校验通过后点「确认并继续」保存 token 并切换到仓库绑定", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockResolvedValue(null);
    authApiMock.status
      .mockResolvedValueOnce({ hasToken: false, repoPath: null })
      .mockResolvedValueOnce({ hasToken: true, repoPath: null });

    renderSetup();
    await loginThrough();

    await waitFor(() => {
      expect(authApiMock.saveToken).toHaveBeenCalledWith("ghp_x");
      expect(screen.getByText("绑定已有仓库")).toBeTruthy();
    });
  });

  it("保存 token 失败时应显示错误而非无响应", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockRejectedValue(new Error("本地加密写入失败"));

    renderSetup();
    await loginThrough();

    await screen.findByText("本地加密写入失败");
    expect(screen.queryByText("绑定已有仓库")).toBeNull();
  });
});

describe("SetupPage 绑定仓库", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("绑定仓库成功后跳转到工作区", async () => {
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null });
    repoApiMock.bind.mockResolvedValue({ repoPath: "/notes/myrepo" });

    renderSetup();

    const urlInput = await screen.findByPlaceholderText("https://github.com/user/my-notes.git");
    fireEvent.change(urlInput, { target: { value: "https://github.com/u/r.git" } });
    fireEvent.click(screen.getByText("绑定"));

    await waitFor(() => {
      expect(repoApiMock.bind).toHaveBeenCalledWith("https://github.com/u/r.git");
      expect(screen.getByText("workspace-page")).toBeTruthy();
    });
  });

  it("保存成功但状态 refetch 失败时仍立即切换到仓库绑定", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockResolvedValue(null);
    authApiMock.status
      .mockResolvedValueOnce({ hasToken: false, repoPath: null })
      .mockRejectedValueOnce(new Error("ipc down"));

    renderSetup();
    await loginThrough();

    await waitFor(() => expect(screen.getByText("绑定已有仓库")).toBeTruthy());
  });
});
