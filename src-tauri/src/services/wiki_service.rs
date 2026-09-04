use std::collections::{BTreeSet, HashMap};
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::note::{extract_title, NoteKind};
use crate::domain::rich_text;
use crate::domain::wiki::{NoteWiki, WikiLinkContext};
use crate::repositories::file_storage;

/// 用例：扫描仓库全部笔记的标签与双链（P1-5）。一次全仓扫描，前端本地聚合反链/标签云。
pub fn wiki_index(repo_path: &Path) -> Result<Vec<NoteWiki>, AppError> {
    let mut notes = Vec::new();
    for file in file_storage::collect_note_files(repo_path)? {
        let content = std::fs::read_to_string(&file)?;
        let rel = file
            .strip_prefix(repo_path)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let fallback = file
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        let kind = NoteKind::of_path(&file).unwrap_or(NoteKind::Markdown);
        let (title, tags, links, link_contexts) = match kind {
            NoteKind::Markdown => (
                extract_title(&content, &fallback),
                extract_tags(&content),
                extract_links(&content),
                extract_link_contexts(&content),
            ),
            NoteKind::RichText => {
                let text = rich_text::plain_text(&content);
                (
                    rich_text::extract_title(&content).unwrap_or(fallback),
                    extract_tags(&text),
                    extract_links(&text),
                    extract_link_contexts(&text),
                )
            }
        };
        notes.push(NoteWiki {
            path: rel.to_string_lossy().into_owned(),
            title,
            tags,
            links,
            link_contexts,
        });
    }
    Ok(notes)
}

/// 单文件内同一目标最多保留的上下文条数（限制 DTO 体积）。
const MAX_CONTEXTS_PER_TARGET: usize = 20;

/// 纯函数：逐行提取双链上下文（含行号），同一目标保留多条供反链面板展示。
pub fn extract_link_contexts(content: &str) -> Vec<WikiLinkContext> {
    let mut contexts = Vec::new();
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for (line_index, line) in content.lines().enumerate() {
        for target in link_targets_in_line(line) {
            if target.is_empty() {
                continue;
            }
            let count = counts.entry(target).or_insert(0);
            if *count >= MAX_CONTEXTS_PER_TARGET {
                continue;
            }
            *count += 1;
            contexts.push(WikiLinkContext {
                target: target.to_string(),
                line: line_index + 1,
                snippet: shorten_context(line),
            });
        }
    }
    contexts
}

/// 纯函数：单行中全部 `[[目标|别名]]` 目标（字节级扫描对 UTF-8 安全）。
fn link_targets_in_line(line: &str) -> Vec<&str> {
    let bytes = line.as_bytes();
    let mut targets = Vec::new();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(close) = find_close(bytes, i + 2) {
                let raw = &line[i + 2..close];
                let target = raw.split('|').next().unwrap_or("").trim();
                if !target.is_empty() {
                    targets.push(target);
                }
                i = close + 2;
                continue;
            }
        }
        i += 1;
    }
    targets
}

fn shorten_context(line: &str) -> String {
    const MAX: usize = 120;
    let trimmed = line.trim();
    if trimmed.chars().count() <= MAX { return trimmed.to_string(); }
    let clipped: String = trimmed.chars().take(MAX - 1).collect();
    format!("{clipped}…")
}

/// 纯函数：提取 `#标签`（行首或空白后紧贴字母/数字/CJK/`_`/`-`/`/`），去重并小写归一化。
/// `# 标题`（# 后空格）不匹配；`#tag1#tag2` 拆成两个标签。字节级扫描对 UTF-8 安全
/// （ASCII 字节不会出现在多字节字符内部，故字节边界即字符边界）。
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
            }
            i = end;
        } else {
            i += 1;
        }
    }
    tags
}

/// 纯函数：提取 `[[目标]]` 双链（支持 `[[目标|别名]]`），去重保留原文。
pub fn extract_links(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut links = Vec::new();
    let mut seen = BTreeSet::new();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(close) = find_close(bytes, i + 2) {
                let raw = &content[i + 2..close];
                let target = raw.split('|').next().unwrap_or("").trim();
                if !target.is_empty() && seen.insert(target.to_string()) {
                    links.push(target.to_string());
                }
                i = close + 2;
                continue;
            }
        }
        i += 1;
    }
    links
}

fn tag_prefix_ok(bytes: &[u8], i: usize) -> bool {
    i == 0 || bytes[i - 1].is_ascii_whitespace()
}

fn is_tag_char(b: u8) -> bool {
    b >= 0x80 || b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b'/'
}

fn find_close(bytes: &[u8], from: usize) -> Option<usize> {
    let mut i = from;
    while i + 1 < bytes.len() {
        if bytes[i] == b']' && bytes[i + 1] == b']' {
            return Some(i);
        }
        i += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn tags_match_inline_and_cjk() {
        assert_eq!(extract_tags("#项目 #bug"), vec!["项目", "bug"]);
        assert_eq!(extract_tags("开头 #tag 结尾"), vec!["tag"]);
        assert_eq!(extract_tags("#中文标签 与 #sub/tag"), vec!["中文标签", "sub/tag"]);
    }

    #[test]
    fn tags_skip_headings_and_duplicates() {
        assert_eq!(extract_tags("# 一级标题\n正文 #foo #Foo"), vec!["foo"]);
        assert_eq!(extract_tags("## 二级 #inline"), vec!["inline"]);
        assert_eq!(extract_tags("#a#b"), vec!["a"]);
        assert_eq!(extract_tags("no tag here"), Vec::<String>::new());
    }

    #[test]
    fn links_extract_targets_and_aliases() {
        assert_eq!(extract_links("见 [[项目计划]] 和 [[A|别名]]"), vec!["项目计划", "A"]);
        assert_eq!(extract_links("[[ 空格 ]]"), vec!["空格"]);
        assert_eq!(extract_links("[[重复]] [[重复]]"), vec!["重复"]);
        assert_eq!(extract_links("无链接 [] [x] [[") , Vec::<String>::new());
    }

    #[test]
    fn link_contexts_capture_multiple_line_snippets_with_lines() {
        let contexts = extract_link_contexts("前文 [[A]] 后文\n再次 [[A]]\n[[B|别名]]");
        assert_eq!(contexts.len(), 3);
        assert_eq!(contexts[0].target, "A");
        assert_eq!(contexts[0].line, 1);
        assert_eq!(contexts[0].snippet, "前文 [[A]] 后文");
        assert_eq!(contexts[1].target, "A");
        assert_eq!(contexts[1].line, 2);
        assert_eq!(contexts[1].snippet, "再次 [[A]]");
        assert_eq!(contexts[2].target, "B");
        assert_eq!(contexts[2].line, 3);
    }

    #[test]
    fn link_contexts_cap_per_target() {
        let mut content = String::new();
        for i in 0..30 {
            content.push_str(&format!("第 {i} 行 [[A]]\n"));
        }
        let contexts = extract_link_contexts(&content);
        assert_eq!(contexts.len(), 20);
        assert!(contexts.iter().all(|c| c.target == "A"));
    }

    #[test]
    fn wiki_index_scans_all_notes() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::write(root.join("a.md"), "# A 笔记\n#tag 链接 [[B 笔记]]").unwrap();
        fs::write(root.join("sub/b.md"), "# B 笔记\n#other [[A 笔记]]").unwrap();
        let notes = wiki_index(root).unwrap();
        assert_eq!(notes.len(), 2);
        let by_path: std::collections::HashMap<_, _> = notes
            .iter()
            .map(|n| (n.path.as_str(), n))
            .collect();
        assert_eq!(by_path["a.md"].title, "A 笔记");
        assert_eq!(by_path["a.md"].tags, vec!["tag"]);
        assert_eq!(by_path["a.md"].links, vec!["B 笔记"]);
        assert_eq!(by_path["a.md"].link_contexts[0].target, "B 笔记");
        assert_eq!(by_path["a.md"].link_contexts[0].line, 2);
        assert_eq!(by_path["sub/b.md"].links, vec!["A 笔记"]);
    }

    #[test]
    fn wiki_index_extracts_tags_and_links_from_rich_text() {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path();
        fs::write(
            root.join("r.ainote"),
            r##"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"富文本笔记"}]},{"type":"paragraph","content":[{"type":"text","text":"#项目 见 [[Markdown 笔记]]"}]}]}"##,
        )
        .unwrap();
        let notes = wiki_index(root).unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0].path, "r.ainote");
        assert_eq!(notes[0].title, "富文本笔记");
        assert_eq!(notes[0].tags, vec!["项目"]);
        assert_eq!(notes[0].links, vec!["Markdown 笔记"]);
        assert_eq!(notes[0].link_contexts[0].target, "Markdown 笔记");
    }
}
