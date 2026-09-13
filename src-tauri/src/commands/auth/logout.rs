use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::services::auth_service;

/// Controller：登出。
///
/// - `provider` 为空：清除全部凭证并重置本地配置（含仓库绑定），即完整登出；
/// - `provider` 指定平台：只断开该平台账号，**保留仓库注册表**，
///   并在仍有其它平台凭证时维持 `hasToken` 标记。
#[tauri::command]
pub async fn logout(app: AppHandle, provider: Option<String>) -> Result<(), AppErrorDto> {
    let Some(id) = provider else {
        let store = auth_service::store(&app).map_err(AppErrorDto::from)?;
        blocking::run(move || store.delete_all())
            .await
            .map_err(AppErrorDto::from)?;
        config::clear(&app)?;
        return Ok(());
    };
    let provider = auth_service::parse_provider(&id).map_err(AppErrorDto::from)?;
    let store = auth_service::store(&app).map_err(AppErrorDto::from)?;
    blocking::run(move || store.delete_token(provider))
        .await
        .map_err(AppErrorDto::from)?;
    config::clear_provider_login(&app, provider.id())?;
    let remaining = auth_service::provider_statuses(&app)?
        .iter()
        .any(|status| status.has_token);
    config::save_token_present(&app, remaining)?;
    Ok(())
}
