use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoPathDto;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, repo_service};

/// Controller：绑定远端仓库（探测 → clone 到默认目录 → 写 config）。
#[tauri::command]
pub async fn bind_repo(app: AppHandle, repo_url: String) -> Result<RepoPathDto, AppErrorDto> {
    let token = auth_service::read_token()?;
    let dest = config::notes_dir(&app)?;
    let backend = Git2Backend;
    let repo_path =
        blocking::run(move || repo_service::bind_repo(&backend, &repo_url, &dest, &token))
            .await
            .map_err(AppErrorDto::from)?;
    config::save_repo_path(&app, &repo_path)?;
    Ok(RepoPathDto { repo_path })
}
