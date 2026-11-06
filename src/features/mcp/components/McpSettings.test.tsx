import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mcpApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  setEnabled: vi.fn(),
  setPort: vi.fn(),
  rotateToken: vi.fn(),
  installIntegration: vi.fn(),
  removeIntegration: vi.fn(),
  installDetected: vi.fn(),
}));

vi.mock("@/api", () => ({
  mcpApi: mcpApiMock,
  messageOf: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

import { McpSettings } from "./McpSettings";

const STATUS = {
  enabled: true,
  running: true,
  url: "http://127.0.0.1:39471/mcp",
  port: 39471,
  hasToken: true,
  lastError: null,
  tools: [
    { name: "read_note", description: "Read a note", writes: false },
    { name: "create_note", description: "Create a note", writes: true },
  ],
  integrations: [
    {
      id: "cursor",
      name: "Cursor",
      configPath: "/home/u/.cursor/mcp.json",
      detected: true,
      configured: false,
      error: null,
    },
    {
      id: "windsurf",
      name: "Windsurf",
      configPath: "/home/u/.codeium/windsurf/mcp_config.json",
      detected: false,
      configured: false,
      error: null,
    },
  ],
};

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <McpSettings />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mcpApiMock.status.mockResolvedValue(STATUS);
  vi.stubGlobal("confirm", vi.fn(() => true));
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(() => Promise.resolve()) },
  });
});

describe("McpSettings", () => {
  it("renders status, connection and tools", async () => {
    renderSettings();
    expect(await screen.findByText("MCP 服务")).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:39471/mcp")).toBeTruthy();
    expect(screen.getByText("read_note")).toBeTruthy();
    expect(screen.getByText("create_note")).toBeTruthy();
    expect(screen.getByText("只读")).toBeTruthy();
    expect(screen.getByText("可写")).toBeTruthy();
  });

  it("enables the server and shows the one-time token dialog", async () => {
    mcpApiMock.status.mockResolvedValue({ ...STATUS, enabled: false, running: false });
    mcpApiMock.setEnabled.mockResolvedValue({
      status: STATUS,
      issuedToken: "ainote_mcp_new",
      clientConfig: '{"mcpServers":{}}',
    });
    renderSettings();
    await screen.findByText("MCP 服务");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(mcpApiMock.setEnabled).toHaveBeenCalledWith(true, 39471),
    );
    expect(await screen.findByText("MCP 访问令牌")).toBeTruthy();
    expect(screen.getByText("ainote_mcp_new")).toBeTruthy();
  });

  it("regenerates the token after confirmation", async () => {
    mcpApiMock.rotateToken.mockResolvedValue({
      status: { ...STATUS, hasToken: true },
      issuedToken: "ainote_mcp_rotated",
      clientConfig: '{"mcpServers":{}}',
    });
    renderSettings();
    await screen.findByText("MCP 服务");
    fireEvent.click(screen.getByRole("button", { name: "重新生成令牌" }));
    await waitFor(() => expect(mcpApiMock.rotateToken).toHaveBeenCalled());
    expect(await screen.findByText("MCP 访问令牌")).toBeTruthy();
    expect(screen.getByText("ainote_mcp_rotated")).toBeTruthy();
  });

  it("applies a valid port and rejects an invalid one", async () => {
    mcpApiMock.setPort.mockResolvedValue({ status: STATUS, issuedToken: null, clientConfig: null });
    renderSettings();
    await screen.findByText("MCP 服务");
    const input = screen.getByLabelText("端口") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "应用端口" }));
    expect(await screen.findByText("端口需在 1024–65535 之间")).toBeTruthy();
    expect(mcpApiMock.setPort).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "39500" } });
    fireEvent.click(screen.getByRole("button", { name: "应用端口" }));
    await waitFor(() => expect(mcpApiMock.setPort).toHaveBeenCalledWith(39500));
  });
});

describe("McpSettings integrations", () => {
  it("writes one client config and updates its status", async () => {
    const configured = {
      ...STATUS,
      integrations: STATUS.integrations.map((item) =>
        item.id === "cursor" ? { ...item, configured: true } : item,
      ),
    };
    mcpApiMock.installIntegration.mockResolvedValue({
      status: configured,
      issuedToken: null,
      clientConfig: null,
    });
    renderSettings();
    await screen.findByText("Cursor");
    const row = screen.getByText("Cursor").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "写入配置" }));
    await waitFor(() => expect(mcpApiMock.installIntegration).toHaveBeenCalledWith("cursor"));
    expect(await within(row).findByText("已配置")).toBeTruthy();
  });

  it("removes a client config", async () => {
    mcpApiMock.status.mockResolvedValue({
      ...STATUS,
      integrations: STATUS.integrations.map((item) =>
        item.id === "cursor" ? { ...item, configured: true } : item,
      ),
    });
    mcpApiMock.removeIntegration.mockResolvedValue({
      status: STATUS,
      issuedToken: null,
      clientConfig: null,
    });
    renderSettings();
    await screen.findByText("Cursor");
    const row = screen.getByText("Cursor").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "移除" }));
    await waitFor(() => expect(mcpApiMock.removeIntegration).toHaveBeenCalledWith("cursor"));
  });

  it("writes all detected clients at once", async () => {
    mcpApiMock.installDetected.mockResolvedValue({
      status: STATUS,
      issuedToken: null,
      clientConfig: null,
    });
    renderSettings();
    await screen.findByText("一键写入客户端");
    fireEvent.click(screen.getByRole("button", { name: "写入全部已检测客户端" }));
    await waitFor(() => expect(mcpApiMock.installDetected).toHaveBeenCalled());
  });
});
