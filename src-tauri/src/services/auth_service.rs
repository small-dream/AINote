//! 认证用例：按托管平台读写访问令牌（桌面端加密文件 / 移动端系统钥匙串），
//! 前端不接触明文；HTTP 校验走 hosting 客户端，阻塞调用由 Command 工作线程承载。

use tauri::AppHandle;

use crate::config;
use crate::domain::dto::HostingProviderDto;
use crate::domain::error::AppError;
use crate::domain::hosting::{self, HostingProvider};
use crate::domain::remote::RemoteCredential;

use super::{auth_store::AuthStore, hosting as hosting_api};

pub fn store(app: &AppHandle) -> Result<AuthStore, AppError> {
    AuthStore::from_app(app)
}

/// 解析 IPC 传入的平台 id；未知 id 返回可读错误。
pub fn parse_provider(id: &str) -> Result<HostingProvider, AppError> {
    HostingProvider::from_id(id)
        .ok_or_else(|| AppError::Repo(format!("未知的托管平台: {id}")))
}

/// 指定平台的远端凭证（令牌 + 平台约定的用户名）。
pub fn credential_for_provider(
    app: &AppHandle,
    provider: HostingProvider,
) -> Result<RemoteCredential, AppError> {
    let store = store(app)?;
    let token = store
        .read_token(provider)
        .map_err(|err| missing_token_error(provider, err))?;
    let login = config::provider_login(app, provider.id())?;
    Ok(RemoteCredential::for_provider(
        provider,
        login.as_deref(),
        &token,
    ))
}

/// 按远端地址推断平台并取其凭证；缺失或未知 host 回退默认平台（历史行为）。
pub fn credential_for_url(
    app: &AppHandle,
    url: Option<&str>,
) -> Result<RemoteCredential, AppError> {
    credential_for_provider(app, hosting::provider_for_url(url))
}

/// 各平台的登录状态（登录页与设置页共用）。
pub fn provider_statuses(app: &AppHandle) -> Result<Vec<HostingProviderDto>, AppError> {
    let store = store(app)?;
    let mut statuses = Vec::with_capacity(hosting::ALL.len());
    for provider in hosting::ALL {
        statuses.push(HostingProviderDto {
            id: provider.id(),
            display_name: provider.display_name(),
            has_token: store.has_token(provider)?,
            login: config::provider_login(app, provider.id())?,
            token_page: provider.token_page(),
            supports_create: provider.supports_create(),
        });
    }
    Ok(statuses)
}

/// 调平台 API 校验令牌，返回账号名；401/403 → AUTH_2001，网络错误 → AUTH_2002。
pub fn validate_token(provider: HostingProvider, token: &str) -> Result<String, AppError> {
    hosting_api::fetch_login(provider, token)
}

/// 未配置令牌时给出可操作错误：带上平台 id，前端可直接引导登录该平台。
fn missing_token_error(provider: HostingProvider, err: AppError) -> AppError {
    match err {
        AppError::Auth(_) => AppError::AuthLoginRequired {
            provider: provider.id().to_string(),
            display_name: provider.display_name().to_string(),
        },
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_token_error_names_the_provider_for_login() {
        let err = missing_token_error(
            HostingProvider::Gitee,
            AppError::Auth("未登录或本地凭证已失效".into()),
        );
        assert_eq!(
            err.to_string(),
            "auth error: 尚未配置 Gitee 的访问令牌，请先登录 Gitee 账号"
        );
        let AppError::AuthLoginRequired { provider, display_name } = err else {
            panic!("应为可引导登录的认证错误");
        };
        assert_eq!(provider, "gitee");
        assert_eq!(display_name, "Gitee");
    }

    #[test]
    fn missing_token_error_keeps_non_auth_errors() {
        let err = missing_token_error(HostingProvider::GitHub, AppError::Io("disk full".into()));
        assert!(matches!(err, AppError::Io(_)));
    }
}
