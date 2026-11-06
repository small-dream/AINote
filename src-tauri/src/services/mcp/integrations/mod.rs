//! 一键写入常见 MCP 客户端配置。
//!
//! 只写 `ainote` 一个条目；Token 由 Rust 从 SecureStore 读取后直接写入客户端配置，
//! 不经过前端。用户仍可在客户端里看到明文 Token，设置页会提示配置文件权限风险。

mod adapters;
mod env;
mod json_file;

use std::path::{Path, PathBuf};

use crate::domain::mcp::McpIntegrationDto;

use adapters::AdapterSpec;
use env::ConfigEnv;

pub struct Integrations {
    env: ConfigEnv,
}

impl Integrations {
    pub fn current() -> Self {
        Self {
            env: ConfigEnv::current(),
        }
    }

    #[cfg(test)]
    pub fn with_env(env: ConfigEnv) -> Self {
        Self { env }
    }

    pub fn list(&self) -> Vec<McpIntegrationDto> {
        adapters::adapters()
            .iter()
            .map(|adapter| self.describe(adapter))
            .collect()
    }

    pub fn install(&self, id: &str, url: &str, token: &str) -> Result<McpIntegrationDto, String> {
        let adapter = adapters::find(id).ok_or_else(|| format!("未知客户端: {id}"))?;
        let path = self.resolve_path(adapter);
        let mut root = json_file::read_root(&path)?;
        json_file::set_server(&mut root, adapter.container, (adapter.entry)(url, token))?;
        json_file::write_root(&path, &root)?;
        Ok(self.describe(adapter))
    }

    pub fn remove(&self, id: &str) -> Result<McpIntegrationDto, String> {
        let adapter = adapters::find(id).ok_or_else(|| format!("未知客户端: {id}"))?;
        let path = self.resolve_path(adapter);
        if !path.exists() {
            return Ok(self.describe(adapter));
        }
        let mut root = json_file::read_root(&path)?;
        json_file::remove_server(&mut root, adapter.container);
        json_file::write_root(&path, &root)?;
        Ok(self.describe(adapter))
    }

    /// 更新所有已配置客户端的 URL / Token；返回失败项，不阻断 Token 轮换或端口修改。
    pub fn sync_configured(&self, url: &str, token: &str) -> Vec<String> {
        let mut warnings = Vec::new();
        for adapter in adapters::adapters() {
            if !self.is_configured(adapter) {
                continue;
            }
            if let Err(error) = self.install(adapter.id, url, token) {
                warnings.push(format!("{}: {error}", adapter.name));
            }
        }
        warnings
    }

    /// 写入全部“已检测到”的客户端；用于“一键写入所有已安装客户端”。
    pub fn install_detected(&self, url: &str, token: &str) -> Vec<String> {
        let mut warnings = Vec::new();
        for adapter in adapters::adapters() {
            if !self.detected(adapter) {
                continue;
            }
            if let Err(error) = self.install(adapter.id, url, token) {
                warnings.push(format!("{}: {error}", adapter.name));
            }
        }
        warnings
    }

    fn is_configured(&self, adapter: &AdapterSpec) -> bool {
        let path = self.resolve_path(adapter);
        json_file::read_root(&path)
            .map(|root| json_file::is_configured(&root, adapter.container))
            .unwrap_or(false)
    }

    fn detected(&self, adapter: &AdapterSpec) -> bool {
        let candidates = (adapter.paths)(&self.env);
        let file_exists = candidates.iter().any(|path| path.is_file());
        if !adapter.detect_parent {
            return file_exists;
        }
        file_exists
            || candidates
                .iter()
                .any(|path| path.parent().is_some_and(Path::is_dir))
    }

    fn describe(&self, adapter: &AdapterSpec) -> McpIntegrationDto {
        let path = self.resolve_path(adapter);
        let (configured, error) = match json_file::read_root(&path) {
            Ok(root) => (
                json_file::is_configured(&root, adapter.container),
                None,
            ),
            Err(error) => (false, Some(error)),
        };
        McpIntegrationDto {
            id: adapter.id.to_string(),
            name: adapter.name.to_string(),
            config_path: path.to_string_lossy().into_owned(),
            detected: self.detected(adapter),
            configured,
            error,
        }
    }

    fn resolve_path(&self, adapter: &AdapterSpec) -> PathBuf {
        let candidates = (adapter.paths)(&self.env);
        if let Some(existing) = candidates.iter().find(|path| path.is_file()) {
            return existing.clone();
        }
        if let Some(existing_parent) = candidates
            .iter()
            .find(|path| path.parent().is_some_and(Path::is_dir))
        {
            return existing_parent.clone();
        }
        candidates
            .into_iter()
            .next()
            .unwrap_or_else(|| PathBuf::from("mcp.json"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn setup() -> (tempfile::TempDir, Integrations) {
        let dir = tempfile::tempdir().unwrap();
        let home = dir.path().join("home");
        let support = dir.path().join("support");
        fs::create_dir_all(home.join(".cursor")).unwrap();
        fs::create_dir_all(support.join("Code").join("User")).unwrap();
        let env = ConfigEnv::for_test(&home, &support);
        (dir, Integrations::with_env(env))
    }

    fn cursor_path(integrations: &Integrations) -> PathBuf {
        let entry = integrations.list().into_iter().find(|item| item.id == "cursor").unwrap();
        PathBuf::from(entry.config_path)
    }

    #[test]
    fn installs_and_merges_cursor_config() {
        let (_dir, integrations) = setup();
        let path = cursor_path(&integrations);
        fs::write(
            &path,
            r#"{"mcpServers":{"other":{"command":"node"}},"theme":"dark"}"#,
        )
        .unwrap();
        let entry = integrations
            .install("cursor", "http://127.0.0.1:39471/mcp", "ainote_mcp_t")
            .unwrap();
        assert!(entry.configured);
        assert!(entry.detected);
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["theme"], "dark");
        assert_eq!(value["mcpServers"]["other"]["command"], "node");
        assert_eq!(
            value["mcpServers"]["ainote"]["headers"]["Authorization"],
            "Bearer ainote_mcp_t"
        );
    }

    #[test]
    fn invalid_json_is_not_overwritten() {
        let (_dir, integrations) = setup();
        let path = cursor_path(&integrations);
        fs::write(&path, "{ broken").unwrap();
        assert!(integrations
            .install("cursor", "http://127.0.0.1:1/mcp", "t")
            .is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "{ broken");
    }

    #[test]
    fn remove_keeps_other_servers() {
        let (_dir, integrations) = setup();
        integrations
            .install("cursor", "http://127.0.0.1:1/mcp", "t")
            .unwrap();
        let path = cursor_path(&integrations);
        let mut value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        value["mcpServers"]["other"] = serde_json::json!({"command": "node"});
        fs::write(&path, serde_json::to_string(&value).unwrap()).unwrap();

        let entry = integrations.remove("cursor").unwrap();
        assert!(!entry.configured);
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["mcpServers"]["other"]["command"], "node");
        assert!(value["mcpServers"].get("ainote").is_none());
    }

    #[test]
    fn sync_updates_only_configured_clients() {
        let (_dir, integrations) = setup();
        integrations
            .install("cursor", "http://127.0.0.1:1/mcp", "old")
            .unwrap();
        let warnings = integrations.sync_configured("http://127.0.0.1:2/mcp", "new");
        assert!(warnings.is_empty());
        let path = cursor_path(&integrations);
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(
            value["mcpServers"]["ainote"]["url"],
            "http://127.0.0.1:2/mcp"
        );
        assert_eq!(
            value["mcpServers"]["ainote"]["headers"]["Authorization"],
            "Bearer new"
        );
        // 未配置的 VS Code 不应被创建。
        assert!(!Path::new(&integrations.list().iter().find(|i| i.id == "vscode").unwrap().config_path).exists());
    }

    #[test]
    fn detection_uses_app_directory_and_file() {
        let (_dir, integrations) = setup();
        let list = integrations.list();
        let cursor = list.iter().find(|item| item.id == "cursor").unwrap();
        let vscode = list.iter().find(|item| item.id == "vscode").unwrap();
        let claude_code = list.iter().find(|item| item.id == "claude-code").unwrap();
        assert!(cursor.detected);
        assert!(vscode.detected);
        assert!(!claude_code.detected);
    }

    #[test]
    fn install_detected_writes_all_detected_clients() {
        let (_dir, integrations) = setup();
        let warnings = integrations.install_detected("http://127.0.0.1:1/mcp", "t");
        assert!(warnings.is_empty());
        for id in ["cursor", "vscode"] {
            let item = integrations.list().into_iter().find(|item| item.id == id).unwrap();
            assert!(item.configured, "{id} should be configured");
        }
    }
}
