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
