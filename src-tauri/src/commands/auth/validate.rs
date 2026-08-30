use crate::commands::blocking;
use crate::domain::dto::LoginDto;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：调 GitHub API 校验 token，返回登录名。
/// 阻塞 HTTP 在本 command 的工作线程中执行（见 lib.rs 说明）。
#[tauri::command]
pub async fn validate_token(token: String) -> Result<LoginDto, AppErrorDto> {
    let login = blocking::run(move || auth_service::validate_token(&token))
        .await
        .map_err(AppErrorDto::from)?;
    Ok(LoginDto { login })
}
