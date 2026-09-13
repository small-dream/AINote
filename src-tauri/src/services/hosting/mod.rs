//! 托管平台 REST 客户端：只用于凭证校验与建仓，数据同步走纯 Git 协议
//! （见 docs/ARCHITECTURE.md §1）。
//!
//! 新增平台 = 在同层增加一个适配文件，并在下面两个入口注册；
//! HTTP 细节与错误映射统一走 `http`，避免各平台各写一套。

mod gitee;
mod github;
mod http;

use crate::domain::error::AppError;
use crate::domain::hosting::HostingProvider;

/// 校验令牌并返回账号名。
pub fn fetch_login(provider: HostingProvider, token: &str) -> Result<String, AppError> {
    match provider {
        HostingProvider::GitHub => github::fetch_login(token),
        HostingProvider::Gitee => gitee::fetch_login(token),
    }
}

/// 应用内建仓，返回 HTTPS clone URL；不支持建仓的平台返回可读错误。
pub fn create_repo(
    provider: HostingProvider,
    token: &str,
    name: &str,
    is_private: bool,
) -> Result<String, AppError> {
    match provider {
        HostingProvider::GitHub => github::create_repo(token, name, is_private),
        other => Err(AppError::Repo(format!(
            "{} 暂不支持应用内建仓，请先在网页端创建仓库再绑定",
            other.display_name()
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_repo_rejects_platforms_without_support() {
        let err = create_repo(HostingProvider::Gitee, "tok", "notes", true).unwrap_err();
        let message = err.to_string();
        assert!(message.contains("Gitee"), "错误信息需指明平台：{message}");
        assert!(message.contains("建仓"), "错误信息需说明能力缺失：{message}");
    }
}
