use tauri::AppHandle;

use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::sync::TreeNode;
use crate::services::note_service;

/// Controller：列出笔记文件树。
#[tauri::command]
pub fn note_tree(app: AppHandle) -> Result<TreeNode, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    note_service::list_tree(&root).map_err(Into::into)
}
