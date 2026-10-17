use std::path::Path;

use crate::domain::ai::ContextSnippet;
use crate::domain::error::AppError;
use crate::domain::note::NoteKind;
use crate::domain::rich_text;
use crate::services::note_content;
use crate::services::search_service;
use crate::services::wiki_parser::{extract_markdown_headings, nearest_heading};

pub const MAX_CONTEXT_RESULTS: usize = 5;
pub const MAX_PARAGRAPH_CHARS: usize = 1200;

/// 全库关键词检索：返回可验证、可点击的结构化来源，而非拼接字符串。
pub fn retrieve_context(
    root: &Path,
    query: &str,
    top_k: usize,
) -> Result<Vec<ContextSnippet>, AppError> {
    let results = search_service::search_notes(root, query)?;
    let mut snippets = Vec::new();
    for result in results {
        if snippets.len() >= top_k {
            break;
        }
        let file = root.join(&result.path);
        let Ok(read) = note_content::read_file(root, &file) else {
            continue;
        };
        // 加密笔记永不进入 AI 上下文，解锁态同样跳过。
        if read.encrypted {
            continue;
        }
        let Some(content) = read.text else {
            continue;
        };
        let kind = NoteKind::of_path(&file).unwrap_or(NoteKind::Markdown);
        let (heading, body) = match kind {
            NoteKind::Markdown => {
                let headings = extract_markdown_headings(&content);
                (nearest_heading(&headings, result.line), content)
            }
            // 搜索行号来自 plain_text；上下文也必须使用同一份纯文本，不能把 JSON 源码当正文。
            NoteKind::RichText => (None, rich_text::plain_text(&content)),
        };
        snippets.push(ContextSnippet {
            index: snippets.len() + 1,
            path: result.path,
            heading,
            line: result.line,
            text: paragraph_around(&body, result.line, MAX_PARAGRAPH_CHARS),
        });
    }
    Ok(snippets)
}

/// 编号来源 + 引用要求；编号与返回的 ContextSnippet.index 一一对应。
pub fn render_context(query: &str, snippets: &[ContextSnippet]) -> String {
    let mut blocks = vec![format!(
        "以下是笔记库中与“{query}”相关的段落。只能依据这些来源回答；引用时使用对应编号 [1]、[2]，不得编造编号。\n"
    )];
    for snippet in snippets {
        let heading = snippet.heading.as_deref().unwrap_or("无标题段落");
        blocks.push(format!(
            "[{index}] 文件：{path}\n标题：{heading}\n行：{line}\n{text}",
            index = snippet.index,
            path = snippet.path,
            line = snippet.line,
            text = snippet.text,
        ));
    }
    blocks.join("\n\n")
}

/// 纯函数：取指定行（1 起）为中心的连续文本块，总长不超过 max_chars。
pub fn paragraph_around(content: &str, line: u32, max_chars: usize) -> String {
    let start = if line > 1 { line - 1 } else { 1 };
    let slice: Vec<&str> = content.lines().skip((start - 1) as usize).take(6).collect();
    let joined = slice.join("\n").trim().to_string();
    if joined.chars().count() <= max_chars {
        joined
    } else {
        let truncated: String = joined.chars().take(max_chars.saturating_sub(1)).collect();
        format!("{truncated}…")
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    #[test]
    fn paragraph_extracts_and_truncates() {
        let content = "line one\nline two\nline three\nline four\nline five\nline six\nline seven";
        let para = paragraph_around(content, 3, 1200);
        assert!(para.contains("line two") && para.contains("line four"));
        assert!(!para.contains("line one"));
        assert!(paragraph_around("abcdefghijklmnopqrstuvwxyz", 1, 10).ends_with('…'));
    }

    #[test]
    fn render_context_numbers_sources() {
        let snippets = vec![ContextSnippet {
            index: 1,
            path: "a.md".into(),
            heading: Some("背景".into()),
            line: 3,
            text: "正文".into(),
        }];
        let prompt = render_context("问题", &snippets);
        assert!(prompt.contains("[1] 文件：a.md"));
        assert!(prompt.contains("标题：背景"));
        assert!(prompt.contains("行：3"));
    }

    #[test]
    fn rich_text_context_uses_plain_text_line_numbers() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(
            root.join("rich.ainote"),
            r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"富文本标题"}]},{"type":"paragraph","content":[{"type":"text","text":"关于 RustLang 的富文本"}]}]}"#,
        )
        .unwrap();

        let snippets = retrieve_context(root, "RustLang", MAX_CONTEXT_RESULTS).unwrap();
        assert_eq!(snippets.len(), 1);
        assert_eq!(snippets[0].line, 2);
        assert!(snippets[0].text.contains("富文本标题"));
        assert!(snippets[0].text.contains("关于 RustLang"));
        assert!(!snippets[0].text.contains("type"));
    }
}
