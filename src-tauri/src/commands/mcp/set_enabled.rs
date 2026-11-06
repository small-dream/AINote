use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::mcp::McpActionDto;
use crate::services::mcp;

/// Controller：启用/停用 MCP 服务；首次启用或 Token 丢失时一次性返回新 Token。
#[tauri::command]
pub async fn mcp_set_enabled(
    app: AppHandle,
    enabled: bool,
    port: Option<u16>,
) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::set_enabled(&app, enabled, port))
        .await
        .map_err(AppErrorDto::from)
}
