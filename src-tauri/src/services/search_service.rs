use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{extract_title, NoteKind};
use crate::domain::rich_text;
use crate::domain::search::SearchResult;
use crate::repositories::file_storage;

const MAX_RESULTS: usize = 30;
const MAX_QUERY_CHARS: usize = 100;
const SNIPPET_MAX_CHARS: usize = 80;

/// 用例：全文搜索笔记（标题 + 正文，忽略大小写）。
/// 标题命中优先，其次按路径字母序；最多返回 30 条。
pub fn search_notes(repo_path: &Path, query: &str) -> Result<Vec<SearchResult>, AppError> {
    let query = query.trim();
    if query.is_empty() || query.chars().count() > MAX_QUERY_CHARS {
        return Ok(Vec::new());
    }
    let mut results = Vec::new();
    for file in file_storage::collect_note_files(repo_path)? {
        let content = std::fs::read_to_string(&file)?;
        let rel = file
            .strip_prefix(repo_path)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let path = rel.to_string_lossy().into_owned();
        let fallback = file
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        let kind = NoteKind::of_path(&file).unwrap_or(NoteKind::Markdown);
        let title = match kind {
            NoteKind::Markdown => extract_title(&content, &fallback),
            NoteKind::RichText => rich_text::extract_title(&content).unwrap_or(fallback),
        };
        let hay = match kind {
            NoteKind::Markdown => content.clone(),
            NoteKind::RichText => rich_text::plain_text(&content),
        };
        if let Some(mut result) = match_note(&path, &title, &hay, query) {
            result.updated_at = file
                .metadata()?
                .modified()?
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            results.push(result);
        }
    }
    sort_by_title_then_path(&mut results, query);
    results.truncate(MAX_RESULTS);
    Ok(results)
}

/// 纯函数：在标题与正文中查找首个命中（忽略大小写），返回片段与行号。
pub fn match_note(path: &str, title: &str, content: &str, query: &str) -> Option<SearchResult> {
    let needle = query.trim().to_lowercase();
    if needle.is_empty() {
        return None;
    }
    let hay = content.to_lowercase();
    let pos = hay.find(&needle)?;
    let line = 1 + hay[..pos].bytes().filter(|&b| b == b'\n').count() as u32;
    let snippet = line_snippet(content, line)?;
    Some(SearchResult {
        path: path.to_string(),
        title: title.to_string(),
        snippet,
        line,
        updated_at: 0,
    })
}

/// 提取指定行（1 起）的原文片段，并限制长度。
fn line_snippet(content: &str, line: u32) -> Option<String> {
    let text = content.lines().nth((line - 1) as usize)?.trim();
    if text.chars().count() <= SNIPPET_MAX_CHARS {
        return Some(text.to_string());
    }
    let truncated: String = text.chars().take(SNIPPET_MAX_CHARS - 1).collect();
    Some(format!("{truncated}…"))
}

/// 标题命中的结果排在正文命中之前；同组按路径字母序。
fn sort_by_title_then_path(results: &mut [SearchResult], query: &str) {
    let needle = query.trim().to_lowercase();
    results.sort_by(|a, b| {
        let a_hit = a.title.to_lowercase().contains(&needle);
        let b_hit = b.title.to_lowercase().contains(&needle);
        b_hit.cmp(&a_hit).then_with(|| a.path.cmp(&b.path))
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn match_finds_content_case_insensitive() {
        let r = match_note("a.md", "标题", "Body about RustLang.\nSecond line.", "rustlang").unwrap();
        assert_eq!(r.path, "a.md");
        assert_eq!(r.line, 1);
        assert!(r.snippet.contains("RustLang"));
    }

    #[test]
    fn match_reports_line_number() {
        let r = match_note("a.md", "t", "line one\nline two rust\nline three", "rust").unwrap();
        assert_eq!(r.line, 2);
        assert_eq!(r.snippet, "line two rust");
    }

    #[test]
    fn no_match_or_empty_query_returns_none() {
        assert!(match_note("a.md", "t", "body", "absent").is_none());
        assert!(match_note("a.md", "t", "body", "   ").is_none());
    }

    #[test]
    fn snippet_truncates_long_lines() {
        let long = format!("prefix {}", "x".repeat(200));
        let r = match_note("a.md", "t", &long, "prefix").unwrap();
        assert!(r.snippet.chars().count() <= SNIPPET_MAX_CHARS);
        assert!(r.snippet.starts_with("prefix "));
    }

    #[test]
    fn search_sorts_title_matches_first_and_ignores_git() {
        let tmp = setup();
        let root = tmp.path();
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("sub/body.md"), "notes about Rust here").unwrap();
        fs::write(root.join("alpha.md"), "# Rust Guide\ncontent").unwrap();
        fs::write(root.join(".git/hidden.md"), "hidden rust file").unwrap();

        let results = search_notes(root, "rust").unwrap();
        let paths: Vec<&str> = results.iter().map(|r| r.path.as_str()).collect();
        assert_eq!(paths, vec!["alpha.md", "sub/body.md"]);
        assert_eq!(results[0].line, 1);
    }

    #[test]
    fn search_rejects_empty_and_overlong_query() {
        let tmp = setup();
        let root = tmp.path();
        assert!(search_notes(root, "  ").unwrap().is_empty());
        let long = "a".repeat(MAX_QUERY_CHARS + 1);
        assert!(search_notes(root, &long).unwrap().is_empty());
    }

    #[test]
    fn search_reports_updated_at() {
        let tmp = setup();
        let root = tmp.path();
        fs::write(root.join("x.md"), "unique token abc").unwrap();
        let results = search_notes(root, "abc").unwrap();
        assert!(results[0].updated_at > 0);
    }

    #[test]
    fn search_finds_rich_text_plain_text() {
        let tmp = setup();
        let root = tmp.path();
        fs::write(
            root.join("r.ainote"),
            r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"富文本标题"}]},{"type":"paragraph","content":[{"type":"text","text":"关于 RustLang 的富文本"}]}]}"#,
        )
        .unwrap();
        let results = search_notes(root, "rustlang").unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].path, "r.ainote");
        assert!(results[0].snippet.contains("RustLang"));
    }
}
