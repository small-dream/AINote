//! 客户端 JSON 配置的读取、合并与原子写。
//!
//! 只修改 `mcpServers.<name>` / `servers.<name>` 一个条目；解析失败时绝不覆盖原文件。

use std::fs;
use std::path::Path;

use serde_json::{Map, Value};

use super::atomic_write;

pub const SERVER_NAME: &str = "ainote";

pub fn read_root(path: &Path) -> Result<Map<String, Value>, String> {
    if !path.exists() {
        return Ok(Map::new());
    }
    let text = fs::read_to_string(path).map_err(|err| format!("读取配置失败: {err}"))?;
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    if text.trim().is_empty() {
        return Ok(Map::new());
    }
    let value: Value =
        serde_json::from_str(text).map_err(|err| format!("配置不是合法 JSON: {err}"))?;
    value
        .as_object()
        .cloned()
        .ok_or_else(|| "配置根节点不是 JSON 对象".to_string())
}

pub fn container<'a>(root: &'a Map<String, Value>, key: &str) -> Option<&'a Map<String, Value>> {
    root.get(key).and_then(Value::as_object)
}

pub fn is_configured(root: &Map<String, Value>, key: &str) -> bool {
    container(root, key).is_some_and(|servers| servers.contains_key(SERVER_NAME))
}

pub fn set_server(root: &mut Map<String, Value>, key: &str, entry: Value) -> Result<(), String> {
    let value = root
        .entry(key.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    let servers = value
        .as_object_mut()
        .ok_or_else(|| format!("{key} 不是 JSON 对象"))?;
    servers.insert(SERVER_NAME.to_string(), entry);
    Ok(())
}

pub fn remove_server(root: &mut Map<String, Value>, key: &str) {
    if let Some(servers) = root.get_mut(key).and_then(Value::as_object_mut) {
        servers.remove(SERVER_NAME);
    }
}

pub fn write_root(path: &Path, root: &Map<String, Value>) -> Result<(), String> {
    let mut text =
        serde_json::to_string_pretty(root).map_err(|err| format!("序列化配置失败: {err}"))?;
    text.push('\n');
    atomic_write::write_atomic(path, text.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn merges_only_ainote_and_preserves_other_servers() {
        let dir = tmp();
        let path = dir.path().join("mcp.json");
        fs::write(
            &path,
            json!({
                "mcpServers": {
                    "other": { "command": "node" }
                },
                "theme": "dark"
            })
            .to_string(),
        )
        .unwrap();
        let mut root = read_root(&path).unwrap();
        set_server(&mut root, "mcpServers", json!({ "url": "http://x" })).unwrap();
        write_root(&path, &root).unwrap();

        let after = read_root(&path).unwrap();
        assert_eq!(after["theme"], "dark");
        assert_eq!(after["mcpServers"]["other"]["command"], "node");
        assert_eq!(after["mcpServers"]["ainote"]["url"], "http://x");
    }

    #[test]
    fn invalid_json_is_rejected_without_overwrite() {
        let dir = tmp();
        let path = dir.path().join("mcp.json");
        let original = "{ not json";
        fs::write(&path, original).unwrap();
        assert!(read_root(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
    }

    #[test]
    fn empty_and_missing_files_become_empty_object() {
        let dir = tmp();
        let missing = dir.path().join("missing.json");
        assert!(read_root(&missing).unwrap().is_empty());
        let empty = dir.path().join("empty.json");
        fs::write(&empty, "  \n").unwrap();
        assert!(read_root(&empty).unwrap().is_empty());
    }

    #[test]
    fn utf8_bom_is_tolerated() {
        let dir = tmp();
        let path = dir.path().join("bom.json");
        fs::write(&path, "\u{feff}{\"mcpServers\":{}}").unwrap();
        assert!(read_root(&path).is_ok());
    }

    #[test]
    fn remove_only_removes_ainote_entry() {
        let dir = tmp();
        let path = dir.path().join("mcp.json");
        fs::write(
            &path,
            json!({
                "mcpServers": {
                    "ainote": { "url": "http://x" },
                    "other": { "url": "http://y" }
                }
            })
            .to_string(),
        )
        .unwrap();
        let mut root = read_root(&path).unwrap();
        remove_server(&mut root, "mcpServers");
        write_root(&path, &root).unwrap();
        let after = read_root(&path).unwrap();
        assert!(!is_configured(&after, "mcpServers"));
        assert_eq!(after["mcpServers"]["other"]["url"], "http://y");
    }

    #[test]
    fn rejects_non_object_container() {
        let mut root = Map::new();
        root.insert("mcpServers".into(), json!([]));
        assert!(set_server(&mut root, "mcpServers", json!({})).is_err());
    }
}
