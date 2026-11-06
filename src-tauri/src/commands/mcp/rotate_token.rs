use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::mcp::McpActionDto;
use crate::services::mcp;

/// Controller：轮换 MCP Token；旧 Token 立即失效，新 Token 只在本次返回。
#[tauri::command]
pub async fn mcp_rotate_token(app: AppHandle) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::rotate_token(&app))
        .await
        .map_err(AppErrorDto::from)
}
