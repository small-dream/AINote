//! 常见 MCP 客户端的配置位置与条目格式。
//!
//! 每种客户端只覆盖自己的容器键与条目字段；写入时只替换 `ainote` 条目，
//! 不改动同一文件里的其他服务器。

use std::path::PathBuf;

use serde_json::{json, Value};

use super::env::{self, ConfigEnv};

pub struct AdapterSpec {
    pub id: &'static str,
    pub name: &'static str,
    /// 顶层容器键：`mcpServers` 或 VS Code 的 `servers`。
    pub container: &'static str,
    /// 父目录存在即视为已安装（Claude Code 只看文件本身）。
    pub detect_parent: bool,
    pub paths: fn(&ConfigEnv) -> Vec<PathBuf>,
    pub entry: fn(url: &str, token: &str) -> Value,
}

pub fn adapters() -> &'static [AdapterSpec] {
    &[
        AdapterSpec {
            id: "claude-code",
            name: "Claude Code",
            container: "mcpServers",
            detect_parent: false,
            paths: env::claude_code,
            entry: http_entry,
        },
        AdapterSpec {
            id: "claude-desktop",
            name: "Claude Desktop",
            container: "mcpServers",
            detect_parent: true,
            paths: env::claude_desktop,
            entry: url_entry,
        },
        AdapterSpec {
            id: "cursor",
            name: "Cursor",
            container: "mcpServers",
            detect_parent: true,
            paths: env::cursor,
            entry: url_entry,
        },
        AdapterSpec {
            id: "vscode",
            name: "VS Code",
            container: "servers",
            detect_parent: true,
            paths: env::vscode,
            entry: http_entry,
        },
        AdapterSpec {
            id: "windsurf",
            name: "Windsurf",
            container: "mcpServers",
            detect_parent: true,
            paths: env::windsurf,
            entry: windsurf_entry,
        },
        AdapterSpec {
            id: "cline",
            name: "Cline",
            container: "mcpServers",
            detect_parent: true,
            paths: env::cline,
            entry: cline_entry,
        },
    ]
}

pub fn find(id: &str) -> Option<&'static AdapterSpec> {
    adapters().iter().find(|adapter| adapter.id == id)
}

fn headers(token: &str) -> Value {
    json!({ "Authorization": format!("Bearer {token}") })
}

fn http_entry(url: &str, token: &str) -> Value {
    json!({
        "type": "http",
        "url": url,
        "headers": headers(token),
    })
}

fn url_entry(url: &str, token: &str) -> Value {
    json!({
        "url": url,
        "headers": headers(token),
    })
}

fn windsurf_entry(url: &str, token: &str) -> Value {
    json!({
        "serverUrl": url,
        "headers": headers(token),
    })
}

fn cline_entry(url: &str, token: &str) -> Value {
    json!({
        "type": "streamableHttp",
        "url": url,
        "headers": headers(token),
        "disabled": false,
        "autoApprove": [],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adapter_ids_are_unique_and_shapes_match_clients() {
        let mut ids = std::collections::HashSet::new();
        for adapter in adapters() {
            assert!(ids.insert(adapter.id), "duplicate id {}", adapter.id);
            let entry = (adapter.entry)("http://127.0.0.1:1/mcp", "t");
            assert_eq!(
                entry["headers"]["Authorization"],
                "Bearer t",
                "{}",
                adapter.id
            );
            match adapter.id {
                "claude-code" | "vscode" => assert_eq!(entry["type"], "http"),
                "windsurf" => assert!(entry.get("serverUrl").is_some()),
                "cline" => assert_eq!(entry["type"], "streamableHttp"),
                _ => assert!(entry.get("url").is_some()),
            }
        }
        assert_eq!(ids.len(), 6);
    }

    #[test]
    fn claude_code_detection_does_not_use_home_directory() {
        let adapter = find("claude-code").unwrap();
        assert!(!adapter.detect_parent);
        assert!(find("cursor").unwrap().detect_parent);
    }
}
