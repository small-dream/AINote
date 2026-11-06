//! TOML 客户端配置（Codex `~/.codex/config.toml`）的读取、合并与原子写。
//!
//! 使用 `toml_edit` 保留用户原有注释与格式，只替换 `mcp_servers.ainote` 表。

use std::fs;
use std::path::Path;

use serde_json::{Map, Value as JsonValue};
use toml_edit::{Array, DocumentMut, Item, Table, Value};

use super::atomic_write;

pub const SERVER_NAME: &str = "ainote";

pub fn read_doc(path: &Path) -> Result<DocumentMut, String> {
    if !path.exists() {
        return Ok(DocumentMut::new());
    }
    let text = fs::read_to_string(path).map_err(|err| format!("读取配置失败: {err}"))?;
    let text = text.strip_prefix('\u{feff}').unwrap_or(&text);
    if text.trim().is_empty() {
        return Ok(DocumentMut::new());
    }
    text.parse::<DocumentMut>()
        .map_err(|err| format!("配置不是合法 TOML: {err}"))
}

pub fn is_configured(doc: &DocumentMut, section: &str) -> bool {
    doc.get(section)
        .and_then(Item::as_table)
        .is_some_and(|table| table.get(SERVER_NAME).is_some())
}

pub fn set_server(doc: &mut DocumentMut, section: &str, entry: &JsonValue) -> Result<(), String> {
    let value = json_to_item(entry)?;
    let item = doc
        .entry(section)
        .or_insert_with(|| Item::Table(Table::new()));
    let table = item
        .as_table_mut()
        .ok_or_else(|| format!("{section} 不是 TOML 表"))?;
    table.insert(SERVER_NAME, value);
    Ok(())
}

pub fn remove_server(doc: &mut DocumentMut, section: &str) {
    if let Some(table) = doc.get_mut(section).and_then(Item::as_table_mut) {
        table.remove(SERVER_NAME);
    }
}

pub fn write_doc(path: &Path, doc: &DocumentMut) -> Result<(), String> {
    atomic_write::write_atomic(path, doc.to_string().as_bytes())
}

fn json_to_item(value: &JsonValue) -> Result<Item, String> {
    match value {
        JsonValue::Object(map) => Ok(Item::Table(json_object_to_table(map)?)),
        JsonValue::String(_) | JsonValue::Bool(_) | JsonValue::Number(_) | JsonValue::Array(_) => {
            Ok(Item::Value(json_to_value(value)?))
        }
        JsonValue::Null => Err("TOML 不支持 null 值".to_string()),
    }
}

fn json_object_to_table(map: &Map<String, JsonValue>) -> Result<Table, String> {
    let mut table = Table::new();
    for (key, value) in map {
        table.insert(key, json_to_item(value)?);
    }
    Ok(table)
}

fn json_to_value(value: &JsonValue) -> Result<Value, String> {
    match value {
        JsonValue::String(text) => Ok(Value::from(text.as_str())),
        JsonValue::Bool(flag) => Ok(Value::from(*flag)),
        JsonValue::Number(number) => {
            if let Some(integer) = number.as_i64() {
                Ok(Value::from(integer))
            } else if let Some(float) = number.as_f64() {
                Ok(Value::from(float))
            } else {
                Err("TOML 数字超出范围".to_string())
            }
        }
        JsonValue::Array(values) => {
            let mut array = Array::new();
            for item in values {
                array.push(json_to_value(item)?);
            }
            Ok(Value::Array(array))
        }
        _ => Err("不支持的 TOML 值".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn writes_codex_table_and_preserves_comments_and_other_servers() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        fs::write(
            &path,
            "# keep me\nmodel = \"x\"\n\n[mcp_servers.other]\ncommand = \"node\"\n",
        )
        .unwrap();
        let mut doc = read_doc(&path).unwrap();
        set_server(
            &mut doc,
            "mcp_servers",
            &json!({
                "url": "http://127.0.0.1:39471/mcp",
                "http_headers": { "Authorization": "Bearer t" }
            }),
        )
        .unwrap();
        write_doc(&path, &doc).unwrap();

        let text = fs::read_to_string(&path).unwrap();
        assert!(text.contains("# keep me"), "{text}");
        assert!(text.contains("[mcp_servers.other]"), "{text}");
        assert!(text.contains("[mcp_servers.ainote]"), "{text}");
        assert!(text.contains("http_headers"), "{text}");
        assert!(text.contains("Bearer t"), "{text}");
        let parsed: DocumentMut = text.parse().unwrap();
        assert!(is_configured(&parsed, "mcp_servers"));
    }

    #[test]
    fn removes_only_ainote() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        fs::write(
            &path,
            "[mcp_servers.ainote]\nurl = \"http://x\"\n\n[mcp_servers.other]\ncommand = \"node\"\n",
        )
        .unwrap();
        let mut doc = read_doc(&path).unwrap();
        remove_server(&mut doc, "mcp_servers");
        write_doc(&path, &doc).unwrap();
        let text = fs::read_to_string(&path).unwrap();
        assert!(!text.contains("[mcp_servers.ainote]"), "{text}");
        assert!(text.contains("[mcp_servers.other]"), "{text}");
    }

    #[test]
    fn invalid_toml_is_rejected() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        fs::write(&path, "[broken").unwrap();
        assert!(read_doc(&path).is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "[broken");
    }

    #[test]
    fn empty_file_becomes_empty_doc() {
        let dir = tmp();
        let path = dir.path().join("config.toml");
        fs::write(&path, " \n").unwrap();
        assert!(read_doc(&path).unwrap().to_string().trim().is_empty());
    }
}
