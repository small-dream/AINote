import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const authApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  validateToken: vi.fn(),
  saveToken: vi.fn(),
}));

const openExternalMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/api", () => ({
  authApi: authApiMock,
  openExternal: openExternalMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

/** 模拟桌面壳：openExternalLink 走 Rust open_external，而不是 window.open */
vi.mock("@/api/back-button.api", () => ({ isTauriRuntime: () => true }));

const providers = [
  { id: "github", displayName: "GitHub", hasToken: false, login: null, tokenPage: "https://github.com/settings/tokens", supportsCreate: true },
  { id: "gitee", displayName: "Gitee", hasToken: false, login: null, tokenPage: "https://gitee.com/profile/personal_access_tokens", supportsCreate: false },
];

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm onSuccess={() => undefined} />
    </QueryClientProvider>
  );
}

describe("LoginForm 获取 Token 入口", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApiMock.status.mockResolvedValue({ hasToken: false, repoPath: null, providers });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 回归：壳内 window.open / target=_blank 会被 WebView2 拦截，按钮点了没有任何反应
  it("点击后交给系统浏览器打开", async () => {
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    renderForm();
    fireEvent.click(await screen.findByRole("button", { name: "如何获取 Token" }));

    await waitFor(() => expect(openExternalMock).toHaveBeenCalledWith("https://github.com/settings/tokens"));
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it("切换平台后打开对应平台的令牌页", async () => {
    renderForm();
    fireEvent.click(await screen.findByRole("tab", { name: "Gitee" }));
    fireEvent.click(screen.getByRole("button", { name: "如何获取 Token" }));

    await waitFor(() =>
      expect(openExternalMock).toHaveBeenCalledWith("https://gitee.com/profile/personal_access_tokens")
    );
  });

  it("tokenPage 不是 http(s) 时不渲染入口", async () => {
    authApiMock.status.mockResolvedValue({
      hasToken: false,
      repoPath: null,
      providers: [{ id: "github", displayName: "GitHub", hasToken: false, login: null, tokenPage: "", supportsCreate: true }],
    });

    renderForm();
    await screen.findByPlaceholderText("粘贴 GitHub 访问令牌");

    expect(screen.queryByRole("button", { name: "如何获取 Token" })).toBeNull();
  });
});
