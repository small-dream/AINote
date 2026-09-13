use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：保存指定托管平台的访问令牌到本地安全存储。
/// `login` 为校验通过的账号名（非敏感），用于设置页展示；为 None 时保留既有记录。
#[tauri::command]
pub async fn save_token(
    app: AppHandle,
    provider: String,
    token: String,
    login: Option<String>,
) -> Result<(), AppErrorDto> {
    let provider = auth_service::parse_provider(&provider).map_err(AppErrorDto::from)?;
    let store = auth_service::store(&app).map_err(AppErrorDto::from)?;
    blocking::run(move || store.save_token(provider, &token))
        .await
        .map_err(AppErrorDto::from)?;
    if let Some(login) = login.filter(|value| !value.trim().is_empty()) {
        config::set_provider_login(&app, provider.id(), login.trim())?;
    }
    config::save_token_present(&app, true)?;
    Ok(())
}
