use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::history::RepoCommit;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::history_service;

/// 单次拉取的最大提交数（前端虚拟滚动足够覆盖，避免大仓库全量遍历）。
const MAX_REPO_COMMITS: usize = 200;

/// Controller：全仓提交历史（含每 commit 直接改动的文件），按时间倒序。
#[tauri::command]
pub async fn git_repo_history(
    app: AppHandle,
    limit: usize,
) -> Result<Vec<RepoCommit>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    let backend = Git2Backend;
    let limit = limit.clamp(1, MAX_REPO_COMMITS);
    blocking::run(move || history_service::repo_history(&backend, &root, limit))
        .await
        .map_err(AppErrorDto::from)
}
