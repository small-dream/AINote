use std::collections::{BTreeSet, HashMap};

use crate::domain::wiki::{WikiHeading, WikiLinkContext};

const MAX_CONTEXTS_PER_TARGET: usize = 20;

/// 拆分 `目标#标题`：标题只取第一个 `#` 后的完整文本（标题本身可含 #）。
pub fn split_link_target(raw: &str) -> (String, Option<String>) {
    let target = raw.split('|').next().unwrap_or("").trim();
    match target.split_once('#') {
        Some((note, heading)) => (
            note.trim().to_string(),
            (!heading.trim().is_empty()).then(|| heading.trim().to_string()),
        ),
        None => (target.to_string(), None),
    }
}

pub fn extract_link_contexts(content: &str) -> Vec<WikiLinkContext> {
    let mut contexts = Vec::new();
    let mut counts: HashMap<String, usize> = HashMap::new();
    for (line_index, line) in content.lines().enumerate() {
        for raw in link_targets_in_line(line) {
            let (target, heading) = split_link_target(raw);
            if target.is_empty() {
                continue;
            }
            let count = counts.entry(target.clone()).or_insert(0);
            if *count >= MAX_CONTEXTS_PER_TARGET {
                continue;
            }
            *count += 1;
            contexts.push(WikiLinkContext {
                target,
                heading,
                line: line_index + 1,
                snippet: shorten_context(line),
            });
        }
    }
    contexts
}

pub fn extract_links(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut links = Vec::new();
    let mut seen = BTreeSet::new();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(close) = find_close(bytes, i + 2) {
                let (target, _) = split_link_target(&content[i + 2..close]);
                if !target.is_empty() && seen.insert(target.clone()) {
                    links.push(target);
                }
                i = close + 2;
                continue;
            }
        }
        i += 1;
    }
    links
}

fn link_targets_in_line(line: &str) -> Vec<&str> {
    let bytes = line.as_bytes();
    let mut targets = Vec::new();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(close) = find_close(bytes, i + 2) {
                let raw = line[i + 2..close].trim();
                if !raw.is_empty() {
                    targets.push(raw);
                }
                i = close + 2;
                continue;
            }
        }
        i += 1;
    }
    targets
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

fn shorten_context(line: &str) -> String {
    const MAX: usize = 120;
    let trimmed = line.trim();
    if trimmed.chars().count() <= MAX {
        return trimmed.to_string();
    }
    let clipped: String = trimmed.chars().take(MAX - 1).collect();
    format!("{clipped}…")
}

/// frontmatter aliases：支持 `aliases: [a, b]`、`aliases: a` 与块列表。
pub fn extract_aliases(content: &str) -> Vec<String> {
    let Some(lines) = frontmatter_lines(content) else {
        return Vec::new();
    };
    let mut aliases = Vec::new();
    let mut in_aliases = false;
    for line in lines {
        if let Some(value) = line.trim_start().strip_prefix("aliases:") {
            in_aliases = true;
            aliases.extend(parse_inline_aliases(value));
            continue;
        }
        if !in_aliases {
            continue;
        }
        let trimmed = line.trim();
        if let Some(value) = trimmed.strip_prefix('-') {
            push_alias(&mut aliases, value);
        } else if !trimmed.is_empty() {
            break;
        }
    }
    aliases
}

fn parse_inline_aliases(value: &str) -> Vec<String> {
    let value = value.trim();
    if value.is_empty() {
        return Vec::new();
    }
    let mut aliases = Vec::new();
    if value.starts_with('[') && value.ends_with(']') {
        for part in value[1..value.len() - 1].split(',') {
            push_alias(&mut aliases, part);
        }
    } else {
        push_alias(&mut aliases, value);
    }
    aliases
}

fn push_alias(out: &mut Vec<String>, raw: &str) {
    let alias = raw.trim().trim_matches(['\'', '"']).trim();
    if !alias.is_empty() && !out.iter().any(|v| v.eq_ignore_ascii_case(alias)) {
        out.push(alias.to_string());
    }
}

fn frontmatter_lines(content: &str) -> Option<Vec<&str>> {
    let mut lines = content.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    let mut out = Vec::new();
    for line in lines {
        if line.trim() == "---" {
            return Some(out);
        }
        out.push(line);
    }
    None
}

/// Markdown 标题：忽略 frontmatter 与围栏代码块，去除行内 Markdown。
pub fn extract_markdown_headings(content: &str) -> Vec<WikiHeading> {
    let mut headings = Vec::new();
    let mut in_fence = false;
    let mut in_frontmatter = false;
    for (index, raw) in content.lines().enumerate() {
        let line = raw.trim_end();
        if index == 0 && line.trim() == "---" {
            in_frontmatter = true;
            continue;
        }
        if in_frontmatter {
            in_frontmatter = line.trim() != "---";
            continue;
        }
        if line.trim_start().starts_with("```") || line.trim_start().starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some((level, text)) = parse_heading(line) {
            headings.push(WikiHeading {
                text,
                level,
                line: index + 1,
            });
        }
    }
    headings
}

fn parse_heading(line: &str) -> Option<(usize, String)> {
    let trimmed = line.trim_start();
    let level = trimmed.chars().take_while(|c| *c == '#').count();
    if !(1..=6).contains(&level) || !trimmed[level..].starts_with([' ', '\t']) {
        return None;
    }
    let text = strip_closing_hashes(trimmed[level..].trim());
    let cleaned = strip_inline_markdown(&text);
    (!cleaned.is_empty()).then_some((level, cleaned))
}

/// 闭合标题的 `#` 必须与前文以空白分隔；因此 `C#` 这类标题不会被误删。
fn strip_closing_hashes(text: &str) -> String {
    let trimmed = text.trim_end();
    let without = trimmed.trim_end_matches('#');
    if without.len() < trimmed.len() && without.ends_with(char::is_whitespace) {
        without.trim_end().to_string()
    } else {
        trimmed.to_string()
    }
}

/// 去掉标题中的行内 Markdown，保留链接/图片的可见文字。
fn strip_inline_markdown(text: &str) -> String {
    let link = regex::Regex::new(r"!?\[([^\]]*)\]\([^)]*\)").expect("valid heading link regex");
    link.replace_all(text, "$1")
        .replace(['`', '*', '_', '~', '[', ']'], "")
        .trim()
        .to_string()
}

pub fn nearest_heading(headings: &[WikiHeading], line: u32) -> Option<String> {
    headings
        .iter()
        .filter(|heading| heading.line <= line as usize)
        .last()
        .map(|heading| heading.text.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_aliases_block_and_inline() {
        let block = "---\ntitle: Demo\naliases:\n  - 项目计划\n  - 'Plan'\n---\n正文";
        assert_eq!(extract_aliases(block), vec!["项目计划", "Plan"]);
        assert_eq!(
            extract_aliases("---\naliases: [A, \"B\"]\n---\n"),
            vec!["A", "B"]
        );
        assert!(extract_aliases("aliases:\n  - ignored").is_empty());
    }

    #[test]
    fn splits_heading_links_and_keeps_alias_out_of_target() {
        assert_eq!(
            split_link_target("笔记#标题|显示"),
            ("笔记".into(), Some("标题".into()))
        );
        assert_eq!(split_link_target("笔记"), ("笔记".into(), None));
        assert_eq!(extract_links("[[A#一]] [[A#二]]"), vec!["A"]);
    }

    #[test]
    fn headings_skip_frontmatter_and_fences() {
        let content = "---\ntitle: x\n---\n# 一级\n```\n## 代码\n```\n### 三级 *强调*";
        let headings = extract_markdown_headings(content);
        assert_eq!(headings.len(), 2);
        assert_eq!(headings[0].text, "一级");
        assert_eq!(headings[1].text, "三级 强调");
        assert_eq!(nearest_heading(&headings, 8).as_deref(), Some("三级 强调"));
    }

    #[test]
    fn headings_strip_markdown_and_preserve_inline_hashes() {
        let headings =
            extract_markdown_headings("## 见 [文档](https://example.com) ##\n### C# 入门");
        assert_eq!(headings[0].text, "见 文档");
        assert_eq!(headings[1].text, "C# 入门");
    }

    #[test]
    fn contexts_include_heading_and_line() {
        let contexts = extract_link_contexts("第一行\n见 [[B#标题|别名]]");
        assert_eq!(contexts[0].target, "B");
        assert_eq!(contexts[0].heading.as_deref(), Some("标题"));
        assert_eq!(contexts[0].line, 2);
    }
}
