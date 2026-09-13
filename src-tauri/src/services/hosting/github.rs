//! GitHub REST 适配（原 services/github_api.rs 的实现迁入）。

use serde_json::Value;

use super::http::{self, UA};
use crate::domain::error::AppError;
use crate::domain::hosting::HostingProvider;

const PROVIDER: HostingProvider = HostingProvider::GitHub;

/// GET /user：校验 token，200 返回登录名。
pub(super) fn fetch_login(token: &str) -> Result<String, AppError> {
    let mut resp = http::agent()
        .get(&format!("{}/user", PROVIDER.api_base()))
        .header("Authorization", &format!("Bearer {token}"))
        .header("User-Agent", UA)
        .call()
        .map_err(map)?;
    let body: Value = resp.body_mut().read_json().map_err(map)?;
    http::json_str(&body, "login", PROVIDER)
}

/// POST /user/repos：创建仓库，返回其 HTTPS clone URL。
pub(super) fn create_repo(token: &str, name: &str, is_private: bool) -> Result<String, AppError> {
    let mut resp = http::agent()
        .post(&format!("{}/user/repos", PROVIDER.api_base()))
        .header("Authorization", &format!("Bearer {token}"))
        .header("User-Agent", UA)
        .send_json(serde_json::json!({ "name": name, "private": is_private }))
        .map_err(map)?;
    let body: Value = resp.body_mut().read_json().map_err(map)?;
    http::json_str(&body, "clone_url", PROVIDER)
}

fn map(err: ureq::Error) -> AppError {
    http::map_http(err, PROVIDER)
}
