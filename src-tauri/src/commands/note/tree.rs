use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::TreeNode;
use crate::services::note_service;

/// Controller：列出笔记文件树。
#[tauri::command]
pub async fn note_tree(app: AppHandle) -> Result<TreeNode, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || note_service::list_tree(&root))
        .await
        .map_err(AppErrorDto::from)
}
