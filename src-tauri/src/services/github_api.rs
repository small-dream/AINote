//! GitHub REST API 客户端（ureq 阻塞式；由 Command 在 Tauri 工作线程中调用）。
//! 仅用于凭证校验与建仓，数据同步走纯 Git 协议（见 ARCHITECTURE.md §1）。

use crate::domain::error::AppError;

const API: &str = "https://api.github.com";
const UA: &str = "AINote";

fn agent() -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(15)))
        .build();
    ureq::Agent::new_with_config(config)
}

fn map_http(err: ureq::Error) -> AppError {
    match err {
        ureq::Error::StatusCode(401) | ureq::Error::StatusCode(403) => {
            AppError::Auth("凭证无效或权限不足".into())
        }
        ureq::Error::StatusCode(code) => AppError::Repo(format!("GitHub API 返回 {code}")),
        other => AppError::AuthNetwork(other.to_string()),
    }
}

/// GET /user：校验 token，200 返回登录名。
pub fn fetch_login(token: &str) -> Result<String, AppError> {
    let mut resp = agent()
        .get(&format!("{API}/user"))
        .header("Authorization", &format!("Bearer {token}"))
        .header("User-Agent", UA)
        .call()
        .map_err(map_http)?;
    let body: serde_json::Value = resp.body_mut().read_json().map_err(map_http)?;
    body.get("login")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| AppError::Repo("GitHub 响应缺少 login 字段".into()))
}

/// POST /user/repos：创建仓库，返回其 HTTPS clone URL。
pub fn create_repo(token: &str, name: &str, is_private: bool) -> Result<String, AppError> {
    let mut resp = agent()
        .post(&format!("{API}/user/repos"))
        .header("Authorization", &format!("Bearer {token}"))
        .header("User-Agent", UA)
        .send_json(serde_json::json!({ "name": name, "private": is_private }))
        .map_err(map_http)?;
    let body: serde_json::Value = resp.body_mut().read_json().map_err(map_http)?;
    body.get("clone_url")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .ok_or_else(|| AppError::Repo("GitHub 响应缺少 clone_url 字段".into()))
}
