use serde::Serialize;

/// wiki_index 返回的单篇笔记（与 src/api/types.ts 的 NoteWikiDto 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWiki {
    /// 相对仓库根目录的路径，如 "daily/2026-08-30.md"
    pub path: String,
    pub title: String,
    /// 内容中提取的标签（已去重、小写归一化）
    pub tags: Vec<String>,
    /// 内容中 [[双链]] 目标（已去重，保留原始书写）
    pub links: Vec<String>,
    pub link_contexts: Vec<WikiLinkContext>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiLinkContext {
    pub target: String,
    pub snippet: String,
}
