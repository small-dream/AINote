use tauri::AppHandle;

use crate::config;
use crate::domain::dto::RepoInfoDto;
use crate::domain::error::AppErrorDto;

/// Controller：列出全部已绑定笔记仓库。
#[tauri::command]
pub fn list_repos(app: AppHandle) -> Result<Vec<RepoInfoDto>, AppErrorDto> {
    let repos = config::repos::list(&app).map_err(AppErrorDto::from)?;
    Ok(repos
        .into_iter()
        .map(|r| RepoInfoDto {
            id: r.id,
            name: r.name,
            path: r.path,
            remote_url: r.remote_url,
        })
        .collect())
}
