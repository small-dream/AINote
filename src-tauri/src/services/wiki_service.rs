use std::collections::BTreeSet;
use std::path::Path;

use crate::domain::error::AppError;
use crate::domain::wiki::{NoteWiki, WikiLinkContext};
use crate::repositories::file_storage;
use crate::services::note_service::extract_title;

/// 用例：扫描仓库全部笔记的标签与双链（P1-5）。一次全仓扫描，前端本地聚合反链/标签云。
pub fn wiki_index(repo_path: &Path) -> Result<Vec<NoteWiki>, AppError> {
    let mut notes = Vec::new();
    for file in file_storage::collect_markdown_files(repo_path)? {
        let content = std::fs::read_to_string(&file)?;
        let rel = file
            .strip_prefix(repo_path)
            .map_err(|e| AppError::Io(e.to_string()))?;
        let fallback = file
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default();
        notes.push(NoteWiki {
            path: rel.to_string_lossy().into_owned(),
            title: extract_title(&content, &fallback),
            tags: extract_tags(&content),
            links: extract_links(&content),
            link_contexts: extract_link_contexts(&content),
        });
    }
    Ok(notes)
}

/// 纯函数：提取双链所在行的简短上下文，供反向链接预览使用。
pub fn extract_link_contexts(content: &str) -> Vec<WikiLinkContext> {
    let mut contexts = Vec::new();
    let mut seen = BTreeSet::new();
    for line in content.lines() {
        let bytes = line.as_bytes();
        let mut i = 0;
        while i + 1 < bytes.len() {
            if bytes[i] == b'[' && bytes[i + 1] == b'[' {
                if let Some(close) = find_close(bytes, i + 2) {
                    let raw = &line[i + 2..close];
                    let target = raw.split('|').next().unwrap_or("").trim();
                    if !target.is_empty() && seen.insert(target.to_string()) {
                        contexts.push(WikiLinkContext { target: target.to_string(), snippet: shorten_context(line) });
                    }
                    i = close + 2;
                    continue;
                }
            }
            i += 1;
        }
    }
    contexts
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
    fn link_contexts_capture_unique_line_snippets() {
        let contexts = extract_link_contexts("前文 [[A]] 后文\n再次 [[A]]\n[[B|别名]]");
        assert_eq!(contexts.len(), 2);
        assert_eq!(contexts[0].target, "A");
        assert_eq!(contexts[0].snippet, "前文 [[A]] 后文");
        assert_eq!(contexts[1].target, "B");
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
        assert_eq!(by_path["sub/b.md"].links, vec!["A 笔记"]);
    }
}
