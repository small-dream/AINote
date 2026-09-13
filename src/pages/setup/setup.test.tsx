import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetupPage } from "./index";

const providers = [
  { id: "github", displayName: "GitHub", hasToken: false, login: null, tokenPage: "https://github.com/settings/tokens", supportsCreate: true },
  { id: "gitee", displayName: "Gitee", hasToken: false, login: null, tokenPage: "https://gitee.com/profile/personal_access_tokens", supportsCreate: false },
];

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
  messageOf: (err: unknown) =>
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err),
  loginProviderOf: (err: unknown) =>
    err && typeof err === "object" && (err as { kind?: string }).kind === "auth"
      ? ((err as { provider?: string }).provider ?? null)
      : null,
}));

function renderSetup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/setup"]}>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/workspace" element={<div>workspace-page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

async function loginThrough() {
  const input = await screen.findByPlaceholderText("粘贴 GitHub 访问令牌");
  fireEvent.change(input, { target: { value: "ghp_x" } });
  fireEvent.click(screen.getByText("校验 Token"));
  await screen.findByText("small-dream");
  fireEvent.click(screen.getByText("确认并继续"));
}

describe("SetupPage 登录并保存 Token", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authApiMock.status.mockResolvedValue({ hasToken: false, repoPath: null, providers });
  });

  it("允许从页面顶部空白区域拖动窗口", () => {
    const { container } = renderSetup();

    expect(container.firstElementChild?.hasAttribute("data-tauri-drag-region")).toBe(true);
  });

  it("校验通过后点「确认并继续」保存 token 并切换到仓库绑定", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockResolvedValue(null);
    authApiMock.status
      .mockResolvedValueOnce({ hasToken: false, repoPath: null, providers })
      .mockResolvedValueOnce({ hasToken: true, repoPath: null, providers });

    renderSetup();
    await loginThrough();

    await waitFor(() => {
      expect(authApiMock.saveToken).toHaveBeenCalledWith("github", "ghp_x", "small-dream");
      expect(screen.getByText("绑定已有仓库")).toBeTruthy();
    });
  });

  it("切换到 Gitee 后按该平台校验并保存凭证", async () => {
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockResolvedValue(null);
    authApiMock.status
      .mockResolvedValueOnce({ hasToken: false, repoPath: null, providers })
      .mockResolvedValueOnce({ hasToken: true, repoPath: null, providers });

    renderSetup();

    fireEvent.click(await screen.findByText("Gitee"));
    const input = await screen.findByPlaceholderText("粘贴 Gitee 访问令牌");
    fireEvent.change(input, { target: { value: "gitee_tok" } });
    fireEvent.click(screen.getByText("校验 Token"));
    await screen.findByText("small-dream");
    fireEvent.click(screen.getByText("确认并继续"));

    await waitFor(() => {
      expect(authApiMock.validateToken).toHaveBeenCalledWith("gitee", "gitee_tok");
      expect(authApiMock.saveToken).toHaveBeenCalledWith("gitee", "gitee_tok", "small-dream");
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
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });
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
      .mockResolvedValueOnce({ hasToken: false, repoPath: null, providers })
      .mockRejectedValueOnce(new Error("ipc down"));

    renderSetup();
    await loginThrough();

    await waitFor(() => expect(screen.getByText("绑定已有仓库")).toBeTruthy());
  });

  it("绑定仓库后仍保留平台列表缓存（否则设置页账户区会空白）", async () => {
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });
    repoApiMock.bind.mockResolvedValue({ repoPath: "/notes/myrepo" });

    const { queryClient } = renderSetup();
    const urlInput = await screen.findByPlaceholderText("https://github.com/user/my-notes.git");
    fireEvent.change(urlInput, { target: { value: "https://gitee.com/u/r.git" } });
    fireEvent.click(screen.getByText("绑定"));

    await waitFor(() => expect(screen.getByText("workspace-page")).toBeTruthy());
    const cached = queryClient.getQueryData<{ providers?: unknown[] }>(["auth-status"]);
    expect(cached?.providers?.length).toBe(providers.length);
  });

});

describe("SetupPage 缺少平台凭证时补登录", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("先登录该平台，再回到绑定表单并保留地址", async () => {
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });
    authApiMock.validateToken.mockResolvedValue({ login: "small-dream" });
    authApiMock.saveToken.mockResolvedValue(null);
    repoApiMock.bind.mockRejectedValue({
      code: "AUTH_2001",
      kind: "auth",
      message: "auth error: 尚未配置 GitHub 的访问令牌，请先登录 GitHub 账号",
      retriable: false,
      provider: "github",
    });

    renderSetup();

    const urlInput = await screen.findByPlaceholderText("https://github.com/user/my-notes.git");
    fireEvent.change(urlInput, { target: { value: "https://github.com/u/r.git" } });
    fireEvent.click(screen.getByText("绑定"));

    // 报错的同时给出可点击的登录入口，用户不会被卡死在绑定表单
    await screen.findByText("auth error: 尚未配置 GitHub 的访问令牌，请先登录 GitHub 账号");
    fireEvent.click(screen.getByText("登录 GitHub 后继续"));

    await loginThrough();

    await waitFor(() => {
      expect(authApiMock.saveToken).toHaveBeenCalledWith("github", "ghp_x", "small-dream");
    });
    const restored = await screen.findByPlaceholderText("https://github.com/user/my-notes.git");
    expect((restored as HTMLInputElement).value).toBe("https://github.com/u/r.git");
  });

  it("补登录步骤可以放弃并返回绑定表单", async () => {
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });
    repoApiMock.bind.mockRejectedValue({
      code: "AUTH_2001",
      kind: "auth",
      message: "尚未配置 Gitee 的访问令牌",
      retriable: false,
      provider: "gitee",
    });

    renderSetup();

    const urlInput = await screen.findByPlaceholderText("https://github.com/user/my-notes.git");
    fireEvent.change(urlInput, { target: { value: "https://gitee.com/u/r.git" } });
    fireEvent.click(screen.getByText("绑定"));
    fireEvent.click(await screen.findByText("登录 Gitee 后继续"));

    await screen.findByPlaceholderText("粘贴 Gitee 访问令牌");
    fireEvent.click(screen.getByText("返回"));

    expect(await screen.findByText("绑定已有仓库")).toBeTruthy();
  });
});

describe("SetupPage 建仓缺少平台账号", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("新建仓库缺少 GitHub 账号时同样给出登录入口", async () => {
    authApiMock.status.mockResolvedValue({ hasToken: true, repoPath: null, providers });

    renderSetup();

    fireEvent.click(await screen.findByText("新建仓库"));
    fireEvent.click(await screen.findByText("登录 GitHub 后继续"));

    expect(await screen.findByPlaceholderText("粘贴 GitHub 访问令牌")).toBeTruthy();
  });
});
