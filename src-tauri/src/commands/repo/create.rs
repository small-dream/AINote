use std::fs;

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoPathDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, repo_service};

/// Controller：在 GitHub 建仓（isPrivate 由前端以 camelCase 传入）并绑定、注册为活动仓库。
#[tauri::command]
pub async fn create_repo(
    app: AppHandle,
    name: String,
    is_private: bool,
) -> Result<RepoPathDto, AppErrorDto> {
    let token = auth_service::read_token(&app)?;
    let notes = config::notes_dir(&app)?;
    fs::create_dir_all(&notes).map_err(AppError::from).map_err(AppErrorDto::from)?;
    let display_name = name.trim().to_string();
    let dest = repo_service::unique_clone_dir(&notes, &display_name)?;
    let backend = Git2Backend;
    let (repo_path, remote_url) = blocking::run(move || {
        repo_service::create_and_bind_repo(&backend, &token, &name, is_private, &dest)
    })
    .await
    .map_err(AppErrorDto::from)?;
    let id = config::repos::register(&app, &display_name, &repo_path, Some(remote_url))?;
    config::repos::switch_to(&app, &id)?;
    Ok(RepoPathDto { repo_path })
}
