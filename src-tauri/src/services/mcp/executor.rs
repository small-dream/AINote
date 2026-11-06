//! 把 MCP 工具接到 Tauri AppHandle：解析活动仓库、检查草稿、抢占写锁并广播 UI 刷新事件。

use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager};

use crate::config;
use crate::domain::mcp::McpNotesChanged;
use crate::services::draft_state::DraftState;
use crate::services::repo_lock::RepoWriteGuard;

use super::tools::{self, ToolCall, ToolError};

/// 传输层只依赖这个 trait，便于 HTTP 测试注入 FakeExecutor。
pub trait ToolExecutor: Send + Sync {
    fn call(&self, name: &str, arguments: &Value) -> Result<ToolCall, ToolError>;
}

pub struct AppToolExecutor {
    app: AppHandle,
}

impl AppToolExecutor {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn emit_changed(&self, tool: &str, result: &ToolCall) {
        let path = result
            .structured
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if let Err(error) = self.app.emit(
            "mcp:notes-changed",
            McpNotesChanged {
                paths: vec![path],
                tool: tool.to_string(),
            },
        ) {
            log::warn!(target: "ainote::mcp", "广播笔记变更失败: {error}");
        }
    }
}

impl ToolExecutor for AppToolExecutor {
    fn call(&self, name: &str, arguments: &Value) -> Result<ToolCall, ToolError> {
        let spec = tools::find(name).ok_or_else(|| {
            ToolError::new("MCP_UNKNOWN_TOOL", format!("Unknown tool: {name}"))
        })?;
        let root = config::require_repo_path(&self.app).map_err(|err| tools::map_app_error(&err))?;
        if spec.writes {
            // 编辑器有未落盘草稿时拒绝写入：MCP 侧无法可靠合并，宁可让 Agent 等待用户保存。
            if self
                .app
                .try_state::<DraftState>()
                .is_some_and(|state| state.get())
            {
                return Err(ToolError::new(
                    "MCP_EDITOR_DIRTY",
                    "The user has unsaved editor changes in AINote. Ask them to save (Ctrl/Cmd+S) and retry.",
                ));
            }
            let _guard = RepoWriteGuard::acquire(
                &self.app,
                root.to_string_lossy().into_owned(),
            )
            .map_err(|err| tools::map_app_error(&err))?;
            let result = tools::execute(&root, name, arguments)?;
            self.emit_changed(name, &result);
            Ok(result)
        } else {
            // 读工具不抢写锁；即使同步正在进行也允许 Agent 读取当前磁盘内容。
            tools::execute(&root, name, arguments)
        }
    }
}

/// 创建共享执行器（服务线程持有）。
pub fn app_executor(app: AppHandle) -> Arc<dyn ToolExecutor> {
    Arc::new(AppToolExecutor::new(app))
}
