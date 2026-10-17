use tauri::AppHandle;

use crate::commands::blocking;
use crate::config;
use crate::domain::error::AppErrorDto;
use crate::domain::wiki::{NoteWiki, UnlinkedMention, UnlinkedMentionRef};
use crate::services::{wiki_mention_service, wiki_service};

/// Controller：扫描仓库全部笔记的标签与双链（P1-5）。
#[tauri::command]
pub async fn wiki_index(app: AppHandle) -> Result<Vec<NoteWiki>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || wiki_service::wiki_index(&root))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：当前笔记的未链接提及（只在双链面板打开时按需扫描）。
#[tauri::command]
pub async fn wiki_unlinked_mentions(
    app: AppHandle,
    path: String,
) -> Result<Vec<UnlinkedMention>, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || wiki_mention_service::unlinked_mentions(&root, &path))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：逐条或批量把未链接提及转换为双链；过期索引整批拒绝。
#[tauri::command]
pub async fn wiki_convert_mentions(
    app: AppHandle,
    target_path: String,
    mentions: Vec<UnlinkedMentionRef>,
) -> Result<usize, AppErrorDto> {
    let root = config::require_repo_path(&app)?;
    blocking::run(move || wiki_mention_service::convert_mentions(&root, &target_path, &mentions))
        .await
        .map_err(AppErrorDto::from)
}
