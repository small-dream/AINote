use serde::Serialize;

/// validate_token 返回：GitHub 登录名
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginDto {
    pub login: String,
}

/// auth_status 返回
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatusDto {
    pub has_token: bool,
    pub repo_path: Option<String>,
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
}

/// get_repo_size 返回：当前 Git 仓库磁盘占用（字节）。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSizeDto {
    pub bytes: u64,
}
