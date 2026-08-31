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
