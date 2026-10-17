use std::collections::BTreeSet;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{extract_title, NoteKind};
use crate::domain::rich_text;
use crate::domain::wiki::{NoteWiki, WikiHeading};
use crate::repositories::file_storage;
use crate::services::note_content;
use crate::services::wiki_parser;

pub use wiki_parser::{
    extract_aliases, extract_link_contexts, extract_links, extract_markdown_headings,
};

/// 用例：扫描仓库全部笔记的标签、别名、标题与双链，一次全仓扫描。
pub fn wiki_index(repo_path: &Path) -> Result<Vec<NoteWiki>, AppError> {
    let mut notes = Vec::new();
    for file in file_storage::collect_note_files(repo_path)? {
        // 锁定的加密笔记不参与索引（解锁后由查询失效触发重扫）。
        let Ok(read) = note_content::read_file(repo_path, &file) else {
            continue;
        };
        let Some(content) = read.text else {
            continue;
        };
        let rel = file
            .strip_prefix(repo_path)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let fallback = file
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        let kind = NoteKind::of_path(&file).unwrap_or(NoteKind::Markdown);
        notes.push(match kind {
            NoteKind::Markdown => NoteWiki {
                path: rel.to_string_lossy().into_owned(),
                title: extract_title(&content, &fallback),
                aliases: extract_aliases(&content),
                tags: extract_tags(&content),
                links: extract_links(&content),
                link_contexts: extract_link_contexts(&content),
                headings: extract_markdown_headings(&content),
            },
            NoteKind::RichText => {
                let text = rich_text::plain_text(&content);
                NoteWiki {
                    path: rel.to_string_lossy().into_owned(),
                    title: rich_text::extract_title(&content).unwrap_or(fallback),
                    aliases: Vec::new(),
                    tags: extract_tags(&text),
                    links: extract_links(&text),
                    link_contexts: extract_link_contexts(&text),
                    headings: rich_text::headings(&content)
                        .into_iter()
                        .map(|(text, level, line)| WikiHeading { text, level, line })
                        .collect(),
                }
            }
        });
    }
    Ok(notes)
}

/// 纯函数：提取 `#标签`（与既有前端规则一致），去重并小写归一化。
pub fn extract_tags(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut tags = Vec::new();
    let mut seen = BTreeSet::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'#' && tag_prefix_ok(bytes, i) {
            let mut end = i + 1;
            while end < bytes.len() && is_tag_char(bytes[end]) {
                end += 1;
            }
            if end > i + 1 {
                let tag = String::from_utf8_lossy(&bytes[i + 1..end]).to_lowercase();
                if seen.insert(tag.clone()) {
                    tags.push(tag);
                }
                i = end;
                continue;
            }
        }
        i += 1;
    }
    tags
}

fn tag_prefix_ok(bytes: &[u8], i: usize) -> bool {
    i == 0 || bytes[i - 1].is_ascii_whitespace()
}

fn is_tag_char(b: u8) -> bool {
    b >= 0x80 || b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'/'
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn tags_match_inline_and_cjk() {
        assert_eq!(extract_tags("#项目 #bug"), vec!["项目", "bug"]);
        assert_eq!(extract_tags("# 一级标题\n正文 #foo #Foo"), vec!["foo"]);
    }

    #[test]
    fn wiki_index_scans_aliases_headings_and_rich_text() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(
            root.join("a.md"),
            "---\naliases: [计划]\n---\n# 标题\n[[B#段落]]",
        )
        .unwrap();
        fs::write(
            root.join("b.ainote"),
            r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"富文本"}]},{"type":"paragraph","content":[{"type":"text","text":"[[A]]"}]}]}"#,
        )
        .unwrap();
        let notes = wiki_index(root).unwrap();
        let a = notes.iter().find(|n| n.path == "a.md").unwrap();
        assert_eq!(a.aliases, vec!["计划"]);
        assert_eq!(a.headings[0].text, "标题");
        assert_eq!(a.link_contexts[0].heading.as_deref(), Some("段落"));
        let b = notes.iter().find(|n| n.path == "b.ainote").unwrap();
        assert_eq!(b.headings[0].text, "富文本");
        assert_eq!(b.links, vec!["A"]);
    }
}
