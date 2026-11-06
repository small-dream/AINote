/** MCP 集成 DTO（与 Rust domain/mcp.rs 保持 serde camelCase 一致） */

/** MCP 工具摘要（Rust 工具注册表下发，避免前后端文案漂移） */
export interface McpToolInfo {
  name: string;
  description: string;
  writes: boolean;
}

/** MCP 服务状态；不含 Token 明文 */
export interface McpStatus {
  enabled: boolean;
  running: boolean;
  url: string;
  port: number;
  hasToken: boolean;
  lastError: string | null;
  tools: McpToolInfo[];
}

/** 启用 / 改端口 / 轮换 Token 的返回：Token 与完整配置只在本次调用下发。 */
export interface McpAction {
  status: McpStatus;
  issuedToken: string | null;
  clientConfig: string | null;
}

/** MCP 写入成功后 Rust 广播的事件载荷 */
export interface McpNotesChanged {
  paths: string[];
  tool: string;
}
