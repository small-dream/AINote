//! 移动端 MCP stub：入站服务不支持，命令返回可读错误，设置入口不展示。

use tauri::AppHandle;

use crate::domain::error::AppError;
use crate::domain::mcp::{endpoint_url, McpActionDto, McpStatusDto};

#[derive(Default)]
pub struct McpState;

pub fn status(_app: &AppHandle) -> Result<McpStatusDto, AppError> {
    Ok(McpStatusDto {
        enabled: false,
        running: false,
        url: endpoint_url(crate::domain::mcp::DEFAULT_MCP_PORT),
        port: crate::domain::mcp::DEFAULT_MCP_PORT,
        has_token: false,
        last_error: Some("MCP 仅支持桌面端".into()),
        tools: Vec::new(),
    })
}

fn unsupported() -> AppError {
    AppError::Mcp("MCP 仅支持桌面端".into())
}

pub fn set_enabled(
    _app: &AppHandle,
    _enabled: bool,
    _port: Option<u16>,
) -> Result<McpActionDto, AppError> {
    Err(unsupported())
}

pub fn set_port(_app: &AppHandle, _port: u16) -> Result<McpActionDto, AppError> {
    Err(unsupported())
}

pub fn rotate_token(_app: &AppHandle) -> Result<McpActionDto, AppError> {
    Err(unsupported())
}

pub fn start_if_enabled(_app: &AppHandle) {}

pub fn shutdown(_app: &AppHandle) {}
