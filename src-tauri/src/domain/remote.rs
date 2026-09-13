//! 远端操作的凭证值类型。
//!
//! Service 层从本地加密存储读出令牌后组装；Repository 只消费，不关心持久化与平台。
//! 用户名必须由平台决定（GitHub 固定 `x-access-token`，Gitee 用账号名），
//! 因此凭证不能再退化为单个 token 字符串。

use crate::domain::hosting::HostingProvider;

/// 一次远端操作使用的 HTTPS 凭证。
#[derive(Clone, PartialEq, Eq)]
pub struct RemoteCredential {
    pub username: String,
    pub token: String,
}

impl RemoteCredential {
    pub fn new(username: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            username: username.into(),
            token: token.into(),
        }
    }

    /// 按平台约定组装：用户名取自平台（Gitee 用账号名，缺失时回退）。
    pub fn for_provider(provider: HostingProvider, login: Option<&str>, token: &str) -> Self {
        Self::new(provider.credential_user(login), token)
    }
}

/// 手写 Debug：令牌不参与格式化输出，避免误入日志或 panic 消息。
impl std::fmt::Debug for RemoteCredential {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RemoteCredential")
            .field("username", &self.username)
            .field("token", &"***")
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn for_provider_uses_platform_username() {
        let github = RemoteCredential::for_provider(HostingProvider::GitHub, Some("alice"), "tok");
        assert_eq!(github.username, "x-access-token");

        let gitee = RemoteCredential::for_provider(HostingProvider::Gitee, Some("alice"), "tok");
        assert_eq!(gitee.username, "alice");

        let anonymous = RemoteCredential::for_provider(HostingProvider::Gitee, None, "tok");
        assert_eq!(anonymous.username, "oauth2");
    }

    #[test]
    fn debug_never_prints_the_token() {
        let cred = RemoteCredential::new("alice", "ghp_super_secret");
        let rendered = format!("{cred:?}");
        assert!(!rendered.contains("ghp_super_secret"), "凭证不得出现在 Debug 输出中");
        assert!(rendered.contains("***"));
    }
}
