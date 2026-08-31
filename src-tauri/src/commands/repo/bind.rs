use std::fs;

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoPathDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, repo_service};

/// Controller：绑定远端仓库（探测 → clone 到唯一目录 → 写入注册表并设为活动仓库）。
#[tauri::command]
pub async fn bind_repo(app: AppHandle, repo_url: String) -> Result<RepoPathDto, AppErrorDto> {
    let token = auth_service::read_token(&app)?;
    let notes = config::notes_dir(&app)?;
    fs::create_dir_all(&notes).map_err(AppError::from).map_err(AppErrorDto::from)?;
    let name = repo_service::derive_name(&repo_url);
    let dest = repo_service::unique_clone_dir(&notes, &name)?;
    let backend = Git2Backend;
    let url = repo_url.clone();
    let repo_path =
        blocking::run(move || repo_service::bind_repo(&backend, &url, &dest, &token))
            .await
            .map_err(AppErrorDto::from)?;
    let id = config::repos::register(&app, &name, &repo_path, Some(repo_url))?;
    config::repos::switch_to(&app, &id)?;
    Ok(RepoPathDto { repo_path })
}
