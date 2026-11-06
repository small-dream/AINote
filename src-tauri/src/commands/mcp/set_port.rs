use tauri::AppHandle;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::mcp::McpActionDto;
use crate::services::mcp;

/// Controller：修改监听端口；服务运行中会重启，失败时尽力恢复旧端口。
#[tauri::command]
pub async fn mcp_set_port(app: AppHandle, port: u16) -> Result<McpActionDto, AppErrorDto> {
    blocking::run(move || mcp::set_port(&app, port))
        .await
        .map_err(AppErrorDto::from)
}
