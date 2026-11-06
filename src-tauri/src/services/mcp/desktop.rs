//! 桌面端 MCP 生命周期：状态、Token、启停、端口与自动启动。

use std::sync::{Arc, Mutex, RwLock};

use tauri::{AppHandle, Manager};

use crate::config;
use crate::domain::error::AppError;
use crate::domain::mcp::{
    endpoint_url, McpActionDto, McpStatusDto, DEFAULT_MCP_PORT,
};

use super::executor;
use super::server::{self, ServerHandle};
use super::{token, tools};

#[derive(Default)]
pub struct McpState {
    running: Mutex<Option<ServerHandle>>,
    token: Arc<RwLock<Option<String>>>,
    last_error: Mutex<Option<String>>,
}

impl McpState {
    fn set_last_error(&self, message: Option<String>) {
        if let Ok(mut guard) = self.last_error.lock() {
            *guard = message;
        }
    }

    fn current_token(&self) -> Option<String> {
        self.token.read().ok().and_then(|guard| guard.clone())
    }

    fn set_token(&self, value: Option<String>) {
        if let Ok(mut guard) = self.token.write() {
            *guard = value;
        }
    }
}

fn validate_port(port: u16) -> Result<(), AppError> {
    if port < 1024 {
        return Err(AppError::Mcp("MCP 端口必须大于等于 1024".into()));
    }
    Ok(())
}

fn ensure_token(state: &McpState, app: &AppHandle) -> Result<(String, bool), AppError> {
    if let Some(token) = state.current_token() {
        return Ok((token, false));
    }
    let (token, generated) = token::ensure_token(app)?;
    state.set_token(Some(token.clone()));
    Ok((token, generated))
}

fn stop_running(state: &McpState) {
    if let Ok(mut guard) = state.running.lock() {
        if let Some(mut handle) = guard.take() {
            handle.stop();
        }
    }
}

fn running(state: &McpState) -> bool {
    let Ok(mut guard) = state.running.lock() else {
        return false;
    };
    match guard.as_mut() {
        Some(handle) if handle.is_alive() => true,
        Some(_) => {
            if let Some(mut dead) = guard.take() {
                dead.stop();
            }
            false
        }
        None => false,
    }
}

fn status_inner(state: &McpState, app: &AppHandle) -> Result<McpStatusDto, AppError> {
    let enabled = config::mcp_enabled(app)?;
    let port = config::mcp_port(app)?;
    let has_token = state.current_token().is_some()
        || matches!(token::read_token(app), Ok(Some(_)));
    let running = running(state);
    let last_error = state.last_error.lock().ok().and_then(|guard| guard.clone());
    Ok(McpStatusDto {
        enabled,
        running,
        url: endpoint_url(port),
        port,
        has_token,
        last_error,
        tools: tools::info(),
    })
}

fn action(
    state: &McpState,
    app: &AppHandle,
    issued_token: Option<String>,
    port: u16,
) -> Result<McpActionDto, AppError> {
    let status = status_inner(state, app)?;
    let client_config = issued_token
        .as_ref()
        .map(|token| token::client_config(port, token));
    Ok(McpActionDto {
        status,
        issued_token,
        client_config,
    })
}

fn start_with(
    state: &McpState,
    app: &AppHandle,
    port: u16,
    token: &str,
) -> Result<(), AppError> {
    validate_port(port)?;
    stop_running(state);
    state.set_token(Some(token.to_string()));
    let executor = executor::app_executor(app.clone());
    let handle = server::start(port, state.token.clone(), executor)?;
    if let Ok(mut guard) = state.running.lock() {
        *guard = Some(handle);
    }
    state.set_last_error(None);
    Ok(())
}

pub fn status(app: &AppHandle) -> Result<McpStatusDto, AppError> {
    let state = app.try_state::<McpState>().ok_or_else(|| {
        AppError::Mcp("MCP 状态不可用（桌面端未初始化）".into())
    })?;
    status_inner(&state, app)
}

pub fn set_enabled(
    app: &AppHandle,
    enabled: bool,
    port: Option<u16>,
) -> Result<McpActionDto, AppError> {
    let state = app.try_state::<McpState>().ok_or_else(|| {
        AppError::Mcp("MCP 状态不可用（桌面端未初始化）".into())
    })?;
    if !enabled {
        stop_running(&state);
        let port = port.unwrap_or(config::mcp_port(app)?);
        config::set_mcp_settings(app, false, port)?;
        state.set_last_error(None);
        return action(&state, app, None, port);
    }

    let previous_port = config::mcp_port(app)?;
    let port = port.unwrap_or(previous_port);
    validate_port(port)?;
    let (token, generated) = ensure_token(&state, app)?;
    if let Err(error) = start_with(&state, app, port, &token) {
        let message = error.to_string();
        state.set_last_error(Some(message.clone()));
        // 启动失败只关闭开关，保留原端口，避免把不可用端口写进配置。
        config::set_mcp_settings(app, false, previous_port)?;
        return Err(error);
    }
    config::set_mcp_settings(app, true, port)?;
    let issued = if generated { Some(token) } else { None };
    action(&state, app, issued, port)
}

pub fn set_port(app: &AppHandle, port: u16) -> Result<McpActionDto, AppError> {
    validate_port(port)?;
    let state = app.try_state::<McpState>().ok_or_else(|| {
        AppError::Mcp("MCP 状态不可用（桌面端未初始化）".into())
    })?;
    let enabled = config::mcp_enabled(app)?;
    if !enabled {
        config::set_mcp_settings(app, false, port)?;
        return action(&state, app, None, port);
    }
    let old_port = config::mcp_port(app)?;
    let (token, _) = ensure_token(&state, app)?;
    if let Err(error) = start_with(&state, app, port, &token) {
        // 尽力恢复旧端口，避免“改端口失败后服务彻底停了”。
        if let Err(restore) = start_with(&state, app, old_port, &token) {
            log::warn!(target: "ainote::mcp", "恢复旧 MCP 端口失败: {restore}");
        }
        state.set_last_error(Some(error.to_string()));
        return Err(error);
    }
    config::set_mcp_settings(app, true, port)?;
    action(&state, app, None, port)
}

pub fn rotate_token(app: &AppHandle) -> Result<McpActionDto, AppError> {
    let state = app.try_state::<McpState>().ok_or_else(|| {
        AppError::Mcp("MCP 状态不可用（桌面端未初始化）".into())
    })?;
    let token = token::rotate_token(app)?;
    state.set_token(Some(token.clone()));
    let port = config::mcp_port(app)?;
    action(&state, app, Some(token), port)
}

/// 启动时自动恢复（失败只记录，不阻断应用启动）。
pub fn start_if_enabled(app: &AppHandle) {
    let enabled = match config::mcp_enabled(app) {
        Ok(enabled) => enabled,
        Err(error) => {
            log::warn!(target: "ainote::mcp", "读取 MCP 开关失败: {error}");
            return;
        }
    };
    if !enabled {
        return;
    }
    let Some(state) = app.try_state::<McpState>() else {
        return;
    };
    let port = config::mcp_port(app).unwrap_or(DEFAULT_MCP_PORT);
    // 自动恢复只使用已存在的 Token：若安全存储被清空，不生成用户无法看到的新 Token。
    match token::read_token(app) {
        Ok(Some(token)) => {
            if let Err(error) = start_with(&state, app, port, &token) {
                log::warn!(target: "ainote::mcp", "自动启动 MCP 失败: {error}");
                state.set_last_error(Some(error.to_string()));
            }
        }
        Ok(None) => {
            let message = "MCP Token 缺失，请在设置中重新生成后再启用".to_string();
            log::warn!(target: "ainote::mcp", "{message}");
            state.set_last_error(Some(message));
        }
        Err(error) => {
            log::warn!(target: "ainote::mcp", "读取 MCP Token 失败: {error}");
            state.set_last_error(Some(error.to_string()));
        }
    }
}

pub fn shutdown(app: &AppHandle) {
    if let Some(state) = app.try_state::<McpState>() {
        stop_running(&state);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_validation_rejects_privileged_and_accepts_normal() {
        assert!(validate_port(80).is_err());
        assert!(validate_port(1024).is_ok());
        assert!(validate_port(DEFAULT_MCP_PORT).is_ok());
    }
}
