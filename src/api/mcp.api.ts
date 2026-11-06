import { call } from "./client";
import type { McpAction, McpStatus } from "./mcp.types";

/** MCP 服务端管理（仅桌面端）。 */
export const mcpApi = {
  status: () => call<McpStatus>("mcp_status"),
  setEnabled: (enabled: boolean, port?: number) =>
    call<McpAction>("mcp_set_enabled", { enabled, port: port ?? null }),
  setPort: (port: number) => call<McpAction>("mcp_set_port", { port }),
  rotateToken: () => call<McpAction>("mcp_rotate_token"),
  installIntegration: (id: string) =>
    call<McpAction>("mcp_install_integration", { id }),
  removeIntegration: (id: string) =>
    call<McpAction>("mcp_remove_integration", { id }),
  installDetected: () => call<McpAction>("mcp_install_detected"),
};
