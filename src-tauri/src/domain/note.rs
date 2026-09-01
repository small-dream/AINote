use serde::{Deserialize, Serialize};
use std::path::Path;

/// 笔记文件扩展名（不含点）
pub const MARKDOWN_EXT: &str = "md";
pub const RICH_TEXT_EXT: &str = "ainote";

/// 笔记类型：Markdown 源码笔记 / 真富文本笔记（TipTap JSON 存储，`.ainote`）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NoteKind {
    Markdown,
    RichText,
}

impl NoteKind {
    /// 按文件扩展名判定笔记类型；非笔记文件返回 None。
    pub fn of_path(path: &Path) -> Option<NoteKind> {
        match path.extension().and_then(|e| e.to_str()) {
            Some(MARKDOWN_EXT) => Some(NoteKind::Markdown),
            Some(RICH_TEXT_EXT) => Some(NoteKind::RichText),
            _ => None,
        }
    }
}

/// 是否为笔记文件（Markdown 或富文本）。
pub fn is_note_file(path: &Path) -> bool {
    NoteKind::of_path(path).is_some()
}

/// 笔记元数据（与 src/features/note/types.ts 的 NoteMeta 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    /// 相对仓库根目录的路径，如 "daily/2026-08-30.md"
    pub path: String,
    pub kind: NoteKind,
    pub title: String,
    pub updated_at: u64,
}

/// 笔记完整内容（read_note 返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub path: String,
    pub kind: NoteKind,
    pub content: String,
}

/// 纯函数：取内容中首个 ATX 一级标题（`# xxx`），无则回退文件名。
/// 置于 domain 供 note/search/wiki/trash 各层复用（repository 只允许依赖 domain）。
pub fn extract_title(content: &str, fallback: &str) -> String {
    for line in content.lines() {
        if let Some(title) = line.strip_prefix("# ") {
            let title = title.trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    fallback.to_string()
}
