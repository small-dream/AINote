//! 笔记仓库托管平台（远端 Git 服务）领域模型。
//!
//! 纯逻辑、零外部依赖：平台元数据 + 远端 URL → 平台识别。
//! 平台差异只在这里定义（API 基址、Token 获取页、HTTPS 凭证用户名）；
//! 新增平台 = 增加一个枚举成员与元数据 + 一个 REST 适配模块
//! （见 docs/ARCHITECTURE.md「托管平台抽象」）。

/// 已支持的托管平台。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostingProvider {
    /// GitHub（默认平台）。
    GitHub,
    /// Gitee（码云）。
    Gitee,
}

/// 全部平台：顺序即前端展示顺序。
pub const ALL: [HostingProvider; 2] = [HostingProvider::GitHub, HostingProvider::Gitee];

/// 未指定平台时的默认值。
///
/// 历史版本只支持 GitHub，且用户可绑定任意自建托管；未知 host 回退到这里，
/// 保证既有用法（如自建 GitLab）不因平台化改造而失效。
pub const DEFAULT: HostingProvider = HostingProvider::GitHub;

impl HostingProvider {
    /// 稳定 id：用于 IPC 参数、凭证文件名与前端文案键。
    pub fn id(self) -> &'static str {
        match self {
            Self::GitHub => "github",
            Self::Gitee => "gitee",
        }
    }

    /// 展示名（品牌名不翻译）。
    pub fn display_name(self) -> &'static str {
        match self {
            Self::GitHub => "GitHub",
            Self::Gitee => "Gitee",
        }
    }

    /// REST API 基址。
    pub fn api_base(self) -> &'static str {
        match self {
            Self::GitHub => "https://api.github.com",
            Self::Gitee => "https://gitee.com/api/v5",
        }
    }

    /// 创建 / 管理访问令牌的页面（登录页「如何获取 Token」跳转）。
    pub fn token_page(self) -> &'static str {
        match self {
            Self::GitHub => "https://github.com/settings/tokens",
            Self::Gitee => "https://gitee.com/profile/personal_access_tokens",
        }
    }

    /// 是否支持应用内建仓（本轮只有 GitHub 提供建仓接口）。
    pub fn supports_create(self) -> bool {
        matches!(self, Self::GitHub)
    }

    /// HTTPS Git 凭证中的用户名。
    ///
    /// GitHub 固定用 `x-access-token`；Gitee 的私人令牌用账号名，
    /// 账号名未知时回退到其 OAuth 克隆约定 `oauth2`。
    pub fn credential_user(self, login: Option<&str>) -> String {
        match self {
            Self::GitHub => "x-access-token".to_string(),
            Self::Gitee => login
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or("oauth2")
                .to_string(),
        }
    }

    /// 由 id 还原平台（大小写不敏感）；未知 id 返回 None。
    pub fn from_id(id: &str) -> Option<Self> {
        let needle = id.trim().to_ascii_lowercase();
        ALL.into_iter().find(|provider| provider.id() == needle)
    }

    /// 由远端 URL 的 host 识别平台；未知 host 返回 None（由调用方决定回退策略）。
    pub fn from_remote_url(url: &str) -> Option<Self> {
        let host = host_of(url)?;
        ALL.into_iter()
            .find(|provider| provider.hosts().contains(&host.as_str()))
    }

    /// 该平台拥有的一级域名（用于识别远端 URL）。
    fn hosts(self) -> &'static [&'static str] {
        match self {
            Self::GitHub => &["github.com"],
            Self::Gitee => &["gitee.com"],
        }
    }
}

/// 解析远端 URL 的 host：小写、去端口、去尾部点与 `www.` 前缀；无法解析返回 None。
///
/// 支持三种写法：`https://user@host:port/path`、`ssh://git@host:port/path`、
/// `git@host:path`（scp 形式，无 scheme）。
pub fn host_of(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let authority = match trimmed.find("://") {
        Some(index) => {
            let rest = &trimmed[index + 3..];
            let end = rest.find(['/', '?', '#']).unwrap_or(rest.len());
            &rest[..end]
        }
        // scp 形式必须带 user@，否则无法与相对路径区分。
        None => {
            let at = trimmed.find('@')?;
            let rest = &trimmed[at + 1..];
            let end = rest.find([':', '/']).unwrap_or(rest.len());
            &rest[..end]
        }
    };
    // 仅剥离 userinfo（`@` 必须在 host 之前），`/path@x` 之类的 `@` 不参与。
    let host_part = authority.rsplit('@').next().unwrap_or(authority);
    normalize_host(host_part)
}

fn normalize_host(raw: &str) -> Option<String> {
    let without_port = raw.split(':').next().unwrap_or_default();
    let host = without_port
        .trim()
        .trim_end_matches('.')
        .to_ascii_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host);
    if host.is_empty() || !host.contains('.') {
        return None;
    }
    Some(host.to_string())
}

/// 由远端 URL 推断平台，**用于选择凭证**：缺失或未知 host 回退 [`DEFAULT`]。
///
/// 展示场景（如仓库列表的平台标签）请改用 [`HostingProvider::from_remote_url`]，
/// 否则没有远端或自建托管的仓库会被错误地标成默认平台。
pub fn provider_for_url(url: Option<&str>) -> HostingProvider {
    url.and_then(HostingProvider::from_remote_url)
        .unwrap_or(DEFAULT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_from_id_is_case_insensitive() {
        assert_eq!(HostingProvider::from_id("GitHub"), Some(HostingProvider::GitHub));
        assert_eq!(HostingProvider::from_id(" gitee "), Some(HostingProvider::Gitee));
        assert_eq!(HostingProvider::from_id("gitlab"), None);
    }

    #[test]
    fn host_of_handles_https_ssh_and_scp_forms() {
        assert_eq!(host_of("https://github.com/u/r.git").as_deref(), Some("github.com"));
        assert_eq!(
            host_of("https://user:pass@gitee.com:443/u/r.git").as_deref(),
            Some("gitee.com")
        );
        assert_eq!(host_of("ssh://git@github.com:22/u/r.git").as_deref(), Some("github.com"));
        assert_eq!(host_of("git@gitee.com:u/r.git").as_deref(), Some("gitee.com"));
        assert_eq!(host_of("HTTPS://WWW.GitHub.com/u/r.git").as_deref(), Some("github.com"));
    }

    #[test]
    fn host_of_rejects_unparsable_input() {
        assert_eq!(host_of("   "), None);
        assert_eq!(host_of("/local/path/repo"), None);
        assert_eq!(host_of("git@localhost:u/r.git"), None);
    }

    #[test]
    fn host_of_ignores_at_sign_inside_path() {
        assert_eq!(
            host_of("https://gitee.com/a@b/c.git").as_deref(),
            Some("gitee.com")
        );
    }

    #[test]
    fn provider_from_remote_url_matches_known_hosts_only() {
        assert_eq!(
            HostingProvider::from_remote_url("https://gitee.com/u/r.git"),
            Some(HostingProvider::Gitee)
        );
        assert_eq!(
            HostingProvider::from_remote_url("git@github.com:u/r.git"),
            Some(HostingProvider::GitHub)
        );
        // 自建 GitLab 与其它托管不得被误判为已支持平台。
        assert_eq!(HostingProvider::from_remote_url("https://gitlab.com/u/r.git"), None);
        assert_eq!(HostingProvider::from_remote_url("https://gitee.com.evil.io/u/r.git"), None);
    }

    #[test]
    fn provider_for_url_falls_back_to_default() {
        assert_eq!(provider_for_url(None), DEFAULT);
        assert_eq!(
            provider_for_url(Some("https://gitlab.example.com/u/r.git")),
            DEFAULT
        );
        assert_eq!(
            provider_for_url(Some("https://gitee.com/u/r.git")),
            HostingProvider::Gitee
        );
    }

    #[test]
    fn credential_user_prefers_login_for_gitee() {
        assert_eq!(HostingProvider::GitHub.credential_user(Some("alice")), "x-access-token");
        assert_eq!(HostingProvider::Gitee.credential_user(Some("alice")), "alice");
        // 账号名未知（历史凭证 / 尚未校验）时回退 Gitee 的 OAuth 克隆约定。
        assert_eq!(HostingProvider::Gitee.credential_user(None), "oauth2");
        assert_eq!(HostingProvider::Gitee.credential_user(Some("  ")), "oauth2");
    }
}
