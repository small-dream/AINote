//! 移动端凭证后端：系统安全存储（iOS Keychain / Android Keystore，keyring 插件）。
//!
//! 条目名 `<平台>_token`；GitHub 沿用历史条目名 `github_token`，老用户升级后不掉登录。

use std::path::Path;

use crate::domain::error::AppError;

const SERVICE: &str = "dev.ainote.app.credentials";

fn store() -> tauri_plugin_keyring_store::KeyringStore {
    tauri_plugin_keyring_store::KeyringStore::new(SERVICE)
}

fn entry(provider_id: &str) -> String {
    format!("{provider_id}_token")
}

pub(super) fn save(_root: &Path, provider_id: &str, token: &str) -> Result<(), AppError> {
    store()
        .set_password(&entry(provider_id), token)
        .map_err(|err| AppError::Io(err.to_string()))
}

pub(super) fn read(_root: &Path, provider_id: &str) -> Result<String, AppError> {
    store()
        .get_password(&entry(provider_id))
        .map_err(|err| AppError::Io(err.to_string()))?
        .ok_or_else(|| AppError::Auth("未登录或本地凭证已失效".into()))
}

pub(super) fn remove(_root: &Path, provider_id: &str) -> Result<(), AppError> {
    store()
        .delete(&entry(provider_id))
        .map_err(|err| AppError::Io(err.to_string()))
}

/// 移动端密钥由系统钥匙串托管，无需额外清理。
pub(super) fn remove_key(_root: &Path) -> Result<(), AppError> {
    Ok(())
}
