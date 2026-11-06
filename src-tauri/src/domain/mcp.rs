//! MCP 集成 DTO 与常量（零 IO）。
//!
//! 这里只放跨层共享的纯数据；协议编解码在 `services/mcp/protocol.rs`，
//! Token 与客户端配置字符串在 `services/mcp/token.rs`。

use serde::Serialize;

/// 默认监听端口（仅 127.0.0.1）。端口可在设置页修改。
pub const DEFAULT_MCP_PORT: u16 = 39471;

/// MCP Bearer Token 前缀，便于日志脱敏与人工识别。
pub const MCP_TOKEN_PREFIX: &str = "ainote_mcp_";

/// 客户端配置中使用的服务名。
pub const MCP_SERVER_NAME: &str = "ainote";

/// MCP 工具在设置页展示的摘要（由 Rust 工具注册表下发，避免前后端漂移）。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfoDto {
    pub name: String,
    pub description: String,
    pub writes: bool,
}

/// 常见 MCP 客户端配置探测结果；不包含 Token。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpIntegrationDto {
    pub id: String,
    pub name: String,
    pub config_path: String,
    /// 是否检测到该客户端（配置文件或应用目录存在）。
    pub detected: bool,
    /// 配置文件中是否已有 `ainote` 条目。
    pub configured: bool,
    /// 读取/解析失败时的可读原因；不包含 Token。
    pub error: Option<String>,
}

/// MCP 服务状态；不含 Token 明文。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatusDto {
    pub enabled: bool,
    pub running: bool,
    pub url: String,
    pub port: u16,
    pub has_token: bool,
    pub last_error: Option<String>,
    pub tools: Vec<McpToolInfoDto>,
    pub integrations: Vec<McpIntegrationDto>,
}

/// 启用 / 改端口 / 轮换 Token / 写入客户端配置的返回。
/// Token 与完整配置只在本次调用下发一次；warnings 汇总客户端配置同步失败项。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpActionDto {
    pub status: McpStatusDto,
    pub issued_token: Option<String>,
    pub client_config: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}


/// MCP 写入成功后广播给前端的事件载荷。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpNotesChanged {
    pub paths: Vec<String>,
    pub tool: String,
}

/// MCP 端点地址（固定回环地址，避免 DNS rebinding 与 IPv6 解析歧义）。
pub fn endpoint_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/mcp")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_is_loopback_mcp_path() {
        assert_eq!(endpoint_url(DEFAULT_MCP_PORT), "http://127.0.0.1:39471/mcp");
    }

    #[test]
    fn status_serializes_camel_case_and_never_contains_token() {
        let json = serde_json::to_value(McpStatusDto {
            enabled: true,
            running: false,
            url: endpoint_url(DEFAULT_MCP_PORT),
            port: DEFAULT_MCP_PORT,
            has_token: true,
            last_error: None,
            tools: vec![McpToolInfoDto {
                name: "read_note".into(),
                description: "read".into(),
                writes: false,
            }],
            integrations: vec![McpIntegrationDto {
                id: "cursor".into(),
                name: "Cursor".into(),
                config_path: "C:/Users/u/.cursor/mcp.json".into(),
                detected: true,
                configured: false,
                error: None,
            }],
        })
        .unwrap();
        assert_eq!(json["hasToken"], true);
        assert_eq!(json["url"], "http://127.0.0.1:39471/mcp");
        assert_eq!(json["tools"][0]["writes"], false);
        assert_eq!(json["integrations"][0]["configured"], false);
        assert!(json.get("token").is_none());
    }
}
