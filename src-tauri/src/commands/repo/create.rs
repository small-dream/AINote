use std::fs;

use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::dto::RepoPathDto;
use crate::domain::error::{AppError, AppErrorDto};
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{auth_service, repo_service};

/// Controller：在指定平台建仓（isPrivate 由前端以 camelCase 传入）并绑定、注册为活动仓库。
/// 当前只有 GitHub 支持应用内建仓，其它平台由 Service 返回可读错误。
#[tauri::command]
pub async fn create_repo(
    app: AppHandle,
    provider: String,
    name: String,
    is_private: bool,
) -> Result<RepoPathDto, AppErrorDto> {
    let provider = auth_service::parse_provider(&provider).map_err(AppErrorDto::from)?;
    let cred = auth_service::credential_for_provider(&app, provider)
        .map_err(|err| AppErrorDto::from(err).with_auth_provider(provider.id()))?;
    let notes = config::notes_dir(&app)?;
    fs::create_dir_all(&notes).map_err(AppError::from).map_err(AppErrorDto::from)?;
    let display_name = name.trim().to_string();
    let dest = repo_service::unique_clone_dir(&notes, &display_name)?;
    let backend = Git2Backend;
    let (repo_path, remote_url) = blocking::run(move || {
        repo_service::create_and_bind_repo(&backend, provider, &cred, &name, is_private, &dest)
    })
    .await
    .map_err(|err| AppErrorDto::from(err).with_auth_provider(provider.id()))?;
    let id = config::repos::register(&app, &display_name, &repo_path, Some(remote_url))?;
    config::repos::switch_to(&app, &id)?;
    Ok(RepoPathDto { repo_path })
}
