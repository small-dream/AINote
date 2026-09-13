//! Gitee（码云）REST 适配：本轮只做凭证校验。
//!
//! 与 GitHub 的实测差异：鉴权头是 `Authorization: token <token>`（GitHub 用 `Bearer`），
//! 且仓库对象没有 `clone_url` 字段（因此应用内建仓暂不开放，见 hosting::create_repo）。

use serde_json::Value;

use super::http::{self, UA};
use crate::domain::error::AppError;
use crate::domain::hosting::HostingProvider;

const PROVIDER: HostingProvider = HostingProvider::Gitee;

/// GET /user：校验 token，200 返回登录名。
pub(super) fn fetch_login(token: &str) -> Result<String, AppError> {
    let mut resp = http::agent()
        .get(&format!("{}/user", PROVIDER.api_base()))
        .header("Authorization", &format!("token {token}"))
        .header("User-Agent", UA)
        .call()
        .map_err(map)?;
    let body: Value = resp.body_mut().read_json().map_err(map)?;
    http::json_str(&body, "login", PROVIDER)
}

fn map(err: ureq::Error) -> AppError {
    http::map_http(err, PROVIDER)
}
