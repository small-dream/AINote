use serde::Serialize;

/// 搜索结果（search_notes 返回，与 src/api/types.ts 的 SearchResult 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    /// 相对仓库根目录的路径，如 "daily/2026-08-30.md"
    pub path: String,
    pub title: String,
    /// 首个命中行附近的上下文片段（原文，长度受限）
    pub snippet: String,
    /// 首个命中所在行号（1 起）
    pub line: u32,
    pub updated_at: u64,
}
