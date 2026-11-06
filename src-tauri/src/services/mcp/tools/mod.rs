//! MCP 工具注册表、调用结果与错误模型。

pub mod args;
pub mod notes;
pub mod schemas;

use std::sync::OnceLock;

use serde_json::{json, Value};

use crate::domain::error::AppError;
use crate::domain::mcp::McpToolInfoDto;

/// 一个工具的静态描述；`input_schema` / `output_schema` 只作为对外契约。
pub struct ToolSpec {
    pub name: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub writes: bool,
    pub input_schema: Value,
    pub output_schema: Option<Value>,
    pub annotations: Value,
}

#[derive(Debug, Clone)]
pub struct ToolCall {
    /// 给模型直接阅读的文本（read_note 返回原文，其余返回 JSON）。
    pub text: String,
    pub structured: Value,
}

impl ToolCall {
    pub fn to_result(&self) -> Value {
        json!({
            "content": [
                { "type": "text", "text": self.text }
            ],
            "structuredContent": self.structured,
            "isError": false,
        })
    }
}

#[derive(Debug, Clone)]
pub struct ToolError {
    pub code: &'static str,
    pub message: String,
    pub data: Option<Value>,
}

impl ToolError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }

    pub fn with_data(mut self, data: Value) -> Self {
        self.data = Some(data);
        self
    }

    pub fn to_result(&self) -> Value {
        let mut structured = json!({
            "error": {
                "code": self.code,
                "message": self.message,
            }
        });
        if let Some(data) = &self.data {
            structured["error"]["data"] = data.clone();
        }
        json!({
            "content": [
                { "type": "text", "text": format!("{}: {}", self.code, self.message) }
            ],
            "structuredContent": structured,
            "isError": true,
        })
    }
}

pub fn specs() -> &'static [ToolSpec] {
    static SPECS: OnceLock<Vec<ToolSpec>> = OnceLock::new();
    SPECS.get_or_init(schemas::specs).as_slice()
}

pub fn find(name: &str) -> Option<&'static ToolSpec> {
    specs().iter().find(|spec| spec.name == name)
}

pub fn info() -> Vec<McpToolInfoDto> {
    specs()
        .iter()
        .map(|spec| McpToolInfoDto {
            name: spec.name.to_string(),
            description: spec.description.to_string(),
            writes: spec.writes,
        })
        .collect()
}

/// `tools/list` 的 result（resultType 由 server 统一补齐）。
pub fn list_result() -> Value {
    let tools: Vec<Value> = specs()
        .iter()
        .map(|spec| {
            let mut tool = json!({
                "name": spec.name,
                "title": spec.title,
                "description": spec.description,
                "inputSchema": spec.input_schema,
                "annotations": spec.annotations,
            });
            if let Some(schema) = &spec.output_schema {
                tool["outputSchema"] = schema.clone();
            }
            tool
        })
        .collect();
    json!({
        "tools": tools,
        "ttlMs": 300_000,
        "cacheScope": "private",
    })
}

pub fn execute(root: &std::path::Path, name: &str, arguments: &Value) -> Result<ToolCall, ToolError> {
    notes::execute(root, name, arguments)
}

/// 把领域错误收敛为不泄漏本机绝对路径 / IO 细节的工具错误。
pub fn map_app_error(err: &AppError) -> ToolError {
    log::warn!(
        target: "ainote::mcp",
        "工具执行失败: {}",
        crate::config::logging::redact(&err.to_string())
    );
    match err {
        AppError::NoteNotFound(path) => {
            ToolError::new("MCP_NOTE_NOT_FOUND", format!("Note not found: {path}"))
        }
        AppError::NoteExists(path) => {
            ToolError::new("MCP_NOTE_EXISTS", format!("Note already exists: {path}"))
        }
        AppError::InvalidPath(path) => ToolError::new(
            "MCP_INVALID_PATH",
            format!("Invalid repository-relative path: {path}"),
        ),
        AppError::VaultLocked(_) => ToolError::new(
            "MCP_VAULT_LOCKED",
            "The encrypted notes vault is locked. Ask the user to unlock it in AINote, then retry.",
        ),
        AppError::VaultCorrupt(_) => ToolError::new(
            "MCP_VAULT_ERROR",
            "The encrypted note is damaged and cannot be read.",
        ),
        AppError::SyncBusy(_) => ToolError::new(
            "MCP_WRITE_BUSY",
            "A Git operation is in progress. Retry after it finishes.",
        ),
        AppError::Conflict(_) => {
            ToolError::new("MCP_CONFLICT", "The operation conflicts with current state.")
        }
        AppError::Repo(_) => ToolError::new(
            "MCP_REPO_MISSING",
            "No notes repository is bound in AINote. Ask the user to bind one.",
        ),
        AppError::Io(_) => ToolError::new(
            "MCP_IO",
            "An I/O error occurred while accessing the note.",
        ),
        _ => ToolError::new("MCP_INTERNAL", "Internal error while accessing the note."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_has_all_tools_and_list_shape() {
        let names: Vec<_> = info().into_iter().map(|tool| tool.name).collect();
        assert_eq!(
            names,
            vec![
                "list_notes",
                "read_note",
                "search_notes",
                "create_note",
                "update_note",
                "append_note",
                "patch_note"
            ]
        );
        assert!(find("read_note").is_some());
        assert!(find("delete_note").is_none());
        let result = list_result();
        assert_eq!(result["cacheScope"], "private");
        assert_eq!(result["tools"].as_array().unwrap().len(), 7);
        assert!(result["tools"][0]["inputSchema"].is_object());
        assert!(result["tools"][0]["annotations"]["readOnlyHint"].is_boolean());
    }

    #[test]
    fn tool_error_is_error_with_code_and_no_path_leak() {
        let err = ToolError::new("MCP_IO", "An I/O error occurred.").with_data(json!({"x":1}));
        let result = err.to_result();
        assert_eq!(result["isError"], true);
        assert!(result["content"][0]["text"]
            .as_str()
            .unwrap()
            .starts_with("MCP_IO:"));
        assert_eq!(result["structuredContent"]["error"]["data"]["x"], 1);
    }

    #[test]
    fn app_errors_map_to_actionable_codes() {
        assert_eq!(
            map_app_error(&AppError::NoteNotFound("a.md".into())).code,
            "MCP_NOTE_NOT_FOUND"
        );
        assert_eq!(
            map_app_error(&AppError::VaultLocked("x".into())).code,
            "MCP_VAULT_LOCKED"
        );
        assert_eq!(
            map_app_error(&AppError::SyncBusy("x".into())).code,
            "MCP_WRITE_BUSY"
        );
        assert_eq!(map_app_error(&AppError::Io("x".into())).code, "MCP_IO");
    }
}
