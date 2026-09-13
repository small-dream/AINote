//! 托管平台 REST 客户端共用的 HTTP 原语（ureq 阻塞式；由 Command 在工作线程中调用）。

use serde_json::Value;

use crate::domain::error::AppError;
use crate::domain::hosting::HostingProvider;

/// 请求 UA：部分平台会拒绝空 UA。
pub(super) const UA: &str = "AINote";

/// 15 秒全局超时的阻塞式 agent。
pub(super) fn agent() -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(15)))
        .build();
    ureq::Agent::new_with_config(config)
}

/// HTTP 错误 → 领域错误：401/403 视为凭证问题，其余带平台名返回。
pub(super) fn map_http(err: ureq::Error, provider: HostingProvider) -> AppError {
    match err {
        ureq::Error::StatusCode(401) | ureq::Error::StatusCode(403) => {
            AppError::Auth("凭证无效或权限不足".into())
        }
        ureq::Error::StatusCode(code) => {
            AppError::Repo(format!("{} API 返回 {code}", provider.display_name()))
        }
        other => AppError::AuthNetwork(other.to_string()),
    }
}

/// 读取响应体中的字符串字段；缺失时给出平台与字段名，便于定位接口差异。
pub(super) fn json_str(
    body: &Value,
    key: &str,
    provider: HostingProvider,
) -> Result<String, AppError> {
    body.get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| {
            AppError::Repo(format!(
                "{} API 响应缺少 {key} 字段",
                provider.display_name()
            ))
        })
}
