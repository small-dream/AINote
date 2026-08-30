use serde::Serialize;

/// 笔记元数据（与 src/features/note/types.ts 的 NoteMeta 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteMeta {
    /// 相对仓库根目录的路径，如 "daily/2026-08-30.md"
    pub path: String,
    pub title: String,
    pub updated_at: u64,
}

/// 笔记完整内容（read_note 返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub path: String,
    pub content: String,
}
