import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mcpApiMock = vi.hoisted(() => ({
  status: vi.fn(),
  setEnabled: vi.fn(),
  setPort: vi.fn(),
  rotateToken: vi.fn(),
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
