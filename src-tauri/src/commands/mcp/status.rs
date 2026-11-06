use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::mcp::McpStatusDto;
use crate::services::mcp;

/// Controller：读取 MCP 服务状态（不返回 Token 明文）。
#[tauri::command]
pub async fn mcp_status(app: AppHandle) -> Result<McpStatusDto, AppErrorDto> {
    blocking::run(move || mcp::status(&app))
        .await
        .map_err(AppErrorDto::from)
}
