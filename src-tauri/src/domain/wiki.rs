use serde::Serialize;

/// wiki_index 返回的单篇笔记（与 src/api/types.ts 的 NoteWikiDto 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteWiki {
    /// 相对仓库根目录的路径，如 "daily/2026-08-30.md"
    pub path: String,
    pub title: String,
    /// frontmatter aliases（Obsidian 兼容，已去重并保留原始书写）
    pub aliases: Vec<String>,
    /// 内容中提取的标签（已去重、小写归一化）
    pub tags: Vec<String>,
    /// 内容中 [[双链]] 目标（已去重，保留原始书写）
    pub links: Vec<String>,
    pub link_contexts: Vec<WikiLinkContext>,
    pub headings: Vec<WikiHeading>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiLinkContext {
    pub target: String,
    pub heading: Option<String>,
    /// 双链所在行号（1 起）
    pub line: usize,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WikiHeading {
    pub text: String,
    pub level: usize,
    /// Markdown 为源码行号；富文本为标题节点序号（1 起）
    pub line: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkedMention {
    pub source_path: String,
    pub source_title: String,
    pub term: String,
    pub line: usize,
    pub snippet: String,
    /// 同一文件内同一 term 的第 n 次出现（0 起），转换时据此重新定位。
    pub occurrence: usize,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkedMentionRef {
    pub source_path: String,
    pub term: String,
    pub occurrence: usize,
}
