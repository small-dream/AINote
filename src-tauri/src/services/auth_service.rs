//! 认证用例：GitHub Token 存于本地加密文件，前端不直接接触明文持久化。
//! HTTP 校验走 github_api；阻塞调用由 Command 所在工作线程承载。

use tauri::AppHandle;

use crate::domain::error::AppError;

use super::{auth_store::AuthStore, github_api};

pub fn store(app: &AppHandle) -> Result<AuthStore, AppError> {
    AuthStore::from_app(app)
}

/// 读取 token；未登录或本地凭证失效返回 AUTH_2001。
pub fn read_token(app: &AppHandle) -> Result<String, AppError> {
    store(app)?.read_token()
}

/// 删除本地加密 token（logout；config 清理由 Command 层编排）。
/// 调 GitHub API 校验 token，返回登录名；401/403 → AUTH_2001，网络错误 → AUTH_2002。
pub fn validate_token(token: &str) -> Result<String, AppError> {
    github_api::fetch_login(token)
}
