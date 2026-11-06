use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::mcp::McpActionDto;
use crate::services::mcp;

/// Controller：把当前服务地址与 Token 直接写入指定客户端的 MCP 配置。
#[tauri::command]
pub async fn mcp_install_integration(
    app: AppHandle,
    id: String,
) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::install_integration(&app, &id))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：从指定客户端配置中移除 ainote 条目。
#[tauri::command]
pub async fn mcp_remove_integration(
    app: AppHandle,
    id: String,
) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::remove_integration(&app, &id))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：写入全部已检测到的客户端配置。
#[tauri::command]
pub async fn mcp_install_detected(app: AppHandle) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::install_detected(&app))
        .await
        .map_err(AppErrorDto::from)
}
