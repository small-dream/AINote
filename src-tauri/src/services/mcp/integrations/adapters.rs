//! 常见 MCP 客户端的配置位置与条目格式。
//!
//! 每种客户端只覆盖自己的容器键与条目字段；写入时只替换 `ainote` 条目，
//! 不改动同一文件里的其他服务器。

use std::path::PathBuf;

use serde_json::{json, Value};

use super::env::{self, ConfigEnv};

pub enum AdapterFormat {
    /// JSON 文件，顶层容器键为 `mcpServers` 或 VS Code 的 `servers`。
    Json { container: &'static str },
    /// TOML 文件，节为 `mcp_servers`（Codex）。
    Toml { section: &'static str },
}

pub struct AdapterSpec {
    pub id: &'static str,
    pub name: &'static str,
    pub format: AdapterFormat,
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
            format: AdapterFormat::Json {
                container: "mcpServers",
            },
            detect_parent: false,
            paths: env::claude_code,
            entry: http_entry,
        },
        AdapterSpec {
            id: "codex",
            name: "Codex",
            format: AdapterFormat::Toml {
                section: "mcp_servers",
            },
            detect_parent: true,
            paths: env::codex,
            entry: codex_entry,
        },
        AdapterSpec {
            id: "cursor",
            name: "Cursor",
            format: AdapterFormat::Json {
                container: "mcpServers",
            },
            detect_parent: true,
            paths: env::cursor,
            entry: url_entry,
        },
        AdapterSpec {
            id: "vscode",
            name: "VS Code",
            format: AdapterFormat::Json { container: "servers" },
            detect_parent: true,
            paths: env::vscode,
            entry: http_entry,
        },
        AdapterSpec {
            id: "windsurf",
            name: "Windsurf",
            format: AdapterFormat::Json {
                container: "mcpServers",
            },
            detect_parent: true,
            paths: env::windsurf,
            entry: windsurf_entry,
        },
        AdapterSpec {
            id: "cline",
            name: "Cline",
            format: AdapterFormat::Json {
                container: "mcpServers",
            },
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

fn codex_entry(url: &str, token: &str) -> Value {
    json!({
        "url": url,
        "http_headers": headers(token),
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
            match adapter.id {
                "codex" => {
                    assert_eq!(entry["http_headers"]["Authorization"], "Bearer t");
                }
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

    #[test]
    fn codex_uses_toml_section() {
        let adapter = find("codex").unwrap();
        match adapter.format {
            AdapterFormat::Toml { section } => assert_eq!(section, "mcp_servers"),
            _ => panic!("codex should use toml"),
        }
    }
}
