use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::repositories::git2_backend::Git2Backend;
use crate::services::{note_service, sync_service};

/// Controller：转换笔记类型（`.md` ↔ `.ainote`）。前端负责把旧内容转换为新类型文本，
/// 后端把旧文件替换为新扩展名文件（原子性由单命令内的写+回收站软删除保证），
/// 原文件移入回收站可恢复；成功后自动生成一次 `note: convert <from> -> <to>` 提交，
/// 提交失败不阻塞转换（工作区仍有未提交变更，可由手动提交/同步兜底）。
#[tauri::command]
pub async fn convert_note(
    app: AppHandle,
    from: String,
    to: String,
    content: String,
) -> Result<(), AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || {
        note_service::convert_note_kind(&root, &from, &to, &content)?;
        let message = format!("note: convert {from} -> {to}");
        if let Err(err) = sync_service::commit_pending(&Git2Backend, &root, &message) {
            log::warn!(
                target: "ainote::note",
                "转换后自动提交失败（不影响转换结果）from={from} to={to} error={err}"
            );
        }
        Ok(())
    })
    .await
    .map_err(AppErrorDto::from)
}
