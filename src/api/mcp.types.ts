/** MCP 集成 DTO（与 Rust domain/mcp.rs 保持 serde camelCase 一致） */

/** MCP 工具摘要（Rust 工具注册表下发，避免前后端文案漂移） */
export interface McpToolInfo {
  name: string;
  description: string;
  writes: boolean;
}

/** 常见 MCP 客户端配置探测结果；不含 Token */
export interface McpIntegration {
  id: string;
  name: string;
  configPath: string;
  detected: boolean;
  configured: boolean;
  error: string | null;
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
  integrations: McpIntegration[];
}

/** 启用 / 改端口 / 轮换 Token / 写入客户端配置的返回。 */
export interface McpAction {
  status: McpStatus;
  issuedToken: string | null;
  clientConfig: string | null;
  /** 客户端配置同步失败项；空数组时 Rust 不序列化。 */
  warnings?: string[];
}

/** MCP 写入成功后 Rust 广播的事件载荷 */
export interface McpNotesChanged {
  paths: string[];
  tool: string;
}
