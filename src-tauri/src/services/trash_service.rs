use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::trash::TrashItem;
use crate::repositories::trash_files;

/// 用例：列出回收站全部条目（按删除时间倒序，P2）。
pub fn list_trash(repo_path: &Path) -> Result<Vec<TrashItem>, AppError> {
    trash_files::list(repo_path)
}

/// 用例：恢复指定条目到原路径（原路径被占用时自动追加序号），返回实际恢复路径。
pub fn restore_trash_item(repo_path: &Path, id: &str) -> Result<String, AppError> {
    trash_files::restore(repo_path, id)
}

/// 用例：彻底删除单个回收站条目。
pub fn delete_trash_item(repo_path: &Path, id: &str) -> Result<(), AppError> {
    trash_files::permanent_delete(repo_path, id)
}

/// 用例：清空回收站。
pub fn empty_trash(repo_path: &Path) -> Result<(), AppError> {
    trash_files::empty(repo_path)
}
