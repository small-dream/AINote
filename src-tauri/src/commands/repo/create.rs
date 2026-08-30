use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoPathDto;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, repo_service};

/// Controller：在 GitHub 建仓（isPrivate 由前端以 camelCase 传入）并绑定。
#[tauri::command]
pub async fn create_repo(
    app: AppHandle,
    name: String,
    is_private: bool,
) -> Result<RepoPathDto, AppErrorDto> {
    let token = auth_service::read_token()?;
    let dest = config::notes_dir(&app)?;
    let backend = Git2Backend;
    let repo_path = blocking::run(move || {
        repo_service::create_and_bind_repo(&backend, &token, &name, is_private, &dest)
    })
    .await
    .map_err(AppErrorDto::from)?;
    config::save_repo_path(&app, &repo_path)?;
    Ok(RepoPathDto { repo_path })
}
