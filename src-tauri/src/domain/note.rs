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

/// 纯函数：取 Markdown 展示标题。优先使用 frontmatter 里的显式 `title`；
/// 否则使用文件名（不含扩展名）。正文标题属于内容，不参与标题推导。
/// 置于 domain 供 note/search/wiki/trash 各层复用（repository 只允许依赖 domain）。
pub fn extract_title(content: &str, fallback: &str) -> String {
    frontmatter_title(content).unwrap_or_else(|| fallback.to_string())
}

/// 从顶部 YAML frontmatter 中读取常见单行标量 `title`；解析失败或值为空时回退文件名。
/// domain 保持零外部依赖，这里只支持裸值 / 单引号 / 双引号。
fn frontmatter_title(content: &str) -> Option<String> {
    let body = content.strip_prefix("---")?;
    if !body.starts_with('\n') && !body.starts_with("\r\n") {
        return None;
    }
    for line in content.lines().skip(1) {
        if line.trim_end() == "---" {
            break;
        }
        if let Some(title) = title_from_line(line) {
            return Some(title);
        }
    }
    None
}

fn title_from_line(line: &str) -> Option<String> {
    let (key, value) = line.split_once(':')?;
    if key.trim() != "title" || key.starts_with(char::is_whitespace) {
        return None;
    }
    let value = value.trim();
    if value.is_empty() || value == "|" || value == ">" {
        return None;
    }
    Some(unwrap_quoted(value).trim().to_string())
}

fn unwrap_quoted(value: &str) -> &str {
    let quote = value.chars().next().unwrap_or_default();
    if (quote == '"' || quote == '\'') && value.len() > 1 && value.ends_with(quote) {
        &value[1..value.len() - 1]
    } else {
        value
    }
}
