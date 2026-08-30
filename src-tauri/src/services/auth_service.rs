//! 认证用例：GitHub Token 只存系统钥匙串（keyring），绝不落盘明文。
//! HTTP 校验走 github_api；阻塞调用由 Command 所在工作线程承载。

use crate::domain::error::AppError;

use super::github_api;

const KEYRING_SERVICE: &str = "dev.mynote.app";
const KEYRING_USER: &str = "github";

fn entry() -> Result<keyring::Entry, AppError> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| AppError::Auth(e.to_string()))
}

pub fn save_token(token: &str) -> Result<(), AppError> {
    entry()?
        .set_password(token)
        .map_err(|e| AppError::Auth(e.to_string()))
}

/// 读取 token；未登录返回 AUTH_2001。
pub fn read_token() -> Result<String, AppError> {
    entry()?
        .get_password()
        .map_err(|_| AppError::Auth("未登录或凭证已失效".into()))
}

pub fn has_token() -> bool {
    entry().is_ok_and(|e| e.get_password().is_ok())
}

/// 删除钥匙串中的 token（logout；config 清理由 Command 层编排）。
pub fn delete_token() -> Result<(), AppError> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Auth(e.to_string())),
    }
}

/// 调 GitHub API 校验 token，返回登录名；401/403 → AUTH_2001，网络错误 → AUTH_2002。
pub fn validate_token(token: &str) -> Result<String, AppError> {
    github_api::fetch_login(token)
}

