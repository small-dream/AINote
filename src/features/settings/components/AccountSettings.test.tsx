import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "./AccountSettings";

const authApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  logout: vi.fn(),
  saveToken: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock("@/api", () => ({
  authApi: authApiMock,
  messageOf: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

const providers = [
  { id: "github", displayName: "GitHub", hasToken: true, login: "alice", tokenPage: "https://github.com/settings/tokens", supportsCreate: true },
  { id: "gitee", displayName: "Gitee", hasToken: false, login: null, tokenPage: "https://gitee.com/profile/personal_access_tokens", supportsCreate: false },
];

function renderAccount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountSettings />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** 按平台定位账户行，避免依赖按钮在列表中的下标。 */
function rowOf(providerName: string) {
  const name = screen.getByText(providerName);
  const row = name.closest("li");
  if (!row) throw new Error(`未找到 ${providerName} 的账户行`);
  return within(row);
}

describe("设置页账户区", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });
  });

  it("按平台展示连接状态与账号名", async () => {
    renderAccount();

    expect(await screen.findByText("已连接：alice")).toBeTruthy();
    expect(rowOf("Gitee").getByText("未连接")).toBeTruthy();
    expect(rowOf("Gitee").getByRole("button", { name: "登录" })).toBeTruthy();
    expect(rowOf("GitHub").getByRole("button", { name: "断开" })).toBeTruthy();
  });

  it("缓存里缺平台列表时自动补拉一次，避免账户区空白", async () => {
    // 模拟历史缓存形状：只有 hasToken / repoPath，没有 providers
    authApiMock.status
      .mockResolvedValueOnce({ hasToken: true, repoPath: null })
      .mockResolvedValueOnce({ hasToken: true, repoPath: null, providers });

    renderAccount();

    expect(await screen.findByText("已连接：alice")).toBeTruthy();
    expect(authApiMock.status).toHaveBeenCalledTimes(2);
  });

  it("断开单个平台只清除该平台账号", async () => {
    authApiMock.logout.mockResolvedValue(null);
    renderAccount();

    await screen.findByText("已连接：alice");
    fireEvent.click(rowOf("GitHub").getByRole("button", { name: "断开" }));

    await waitFor(() => expect(authApiMock.logout).toHaveBeenCalledWith("github"));
  });

  it("为未连接平台补登录时按该平台校验并保存", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "bob" });
    authApiMock.saveToken.mockResolvedValue(null);
    renderAccount();

    await screen.findByText("已连接：alice");
    fireEvent.click(rowOf("Gitee").getByRole("button", { name: "登录" }));

    const input = await screen.findByPlaceholderText("粘贴 Gitee 访问令牌");
    fireEvent.change(input, { target: { value: "gitee_tok" } });
    fireEvent.click(screen.getByText("校验 Token"));
    await screen.findByText("bob");
    fireEvent.click(screen.getByText("确认并继续"));

    await waitFor(() => {
      expect(authApiMock.validateToken).toHaveBeenCalledWith("gitee", "gitee_tok");
      expect(authApiMock.saveToken).toHaveBeenCalledWith("gitee", "gitee_tok", "bob");
    });
  });
});
