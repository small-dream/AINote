use serde::Serialize;

use crate::domain::hosting::HostingProvider;

/// validate_token 返回：托管平台账号名
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginDto {
    pub login: String,
}

/// 单个托管平台的登录状态（auth_status.providers 元素）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostingProviderDto {
    pub id: &'static str,
    pub display_name: &'static str,
    /// 该平台是否已保存可用令牌
    pub has_token: bool,
    /// 已保存的账号名（未登录或历史凭证无记录时为 None）
    pub login: Option<String>,
    /// 创建 / 管理访问令牌的页面
    pub token_page: &'static str,
    /// 是否支持应用内建仓
    pub supports_create: bool,
}

/// auth_status 返回
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatusDto {
    /// 任一平台已配置令牌即为 true（启动路由守卫沿用该语义）
    pub has_token: bool,
    pub repo_path: Option<String>,
    pub providers: Vec<HostingProviderDto>,
}

/// bind_repo / create_repo 返回
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoPathDto {
    pub repo_path: String,
}

/// list_repos 返回的单仓库信息
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfoDto {
    pub id: String,
    pub name: String,
    pub path: String,
    pub remote_url: Option<String>,
    /// 远端所属平台 id；**无远端或未识别的 host 为 None**（此时不展示平台标签）
    pub provider_id: Option<&'static str>,
}

impl RepoInfoDto {
    /// 由远端地址推导已支持的平台；无法识别时返回 None（展示层据此不渲染标签）。
    ///
    /// 这里刻意不用带回退的 `provider_for_url`：那是给凭证选择用的，
    /// 把「没有远端」的仓库标成默认平台会误导用户。
    pub fn provider_of(remote_url: Option<&str>) -> Option<&'static str> {
        remote_url
            .and_then(HostingProvider::from_remote_url)
            .map(HostingProvider::id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repo_provider_label_only_for_recognized_hosts() {
        assert_eq!(
            RepoInfoDto::provider_of(Some("https://gitee.com/u/notes.git")),
            Some("gitee")
        );
        assert_eq!(
            RepoInfoDto::provider_of(Some("git@github.com:u/notes.git")),
            Some("github")
        );
        // 从备份恢复或早期迁移的仓库没有远端记录，不得标成默认平台。
        assert_eq!(RepoInfoDto::provider_of(None), None);
        // 自建托管无法判断归属，同样不展示标签。
        assert_eq!(
            RepoInfoDto::provider_of(Some("https://gitlab.example.com/u/notes.git")),
            None
        );
    }
}

/// get_repo_size 返回：当前 Git 仓库磁盘占用（字节）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSizeDto {
    pub bytes: u64,
}
