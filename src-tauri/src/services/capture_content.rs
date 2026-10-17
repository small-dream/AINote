use std::path::Path;

use time::macros::format_description;
use time::OffsetDateTime;

use crate::domain::capture::CaptureInputDto;

const MAX_TITLE_CHARS: usize = 80;
const MAX_SLUG_CHARS: usize = 32;
const MAX_TAGS: usize = 10;
const MAX_TAG_CHARS: usize = 50;

/// 首行生成标题；图片/链接兜底保证每次捕获都有可读名称。
pub fn capture_title(text: &str, has_image: bool, link: Option<&str>) -> String {
    let first = text
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(str::trim);
    let fallback = if has_image {
        "图片捕捉"
    } else if link.is_some_and(|value| !value.trim().is_empty()) {
        "链接捕捉"
    } else {
        "快速捕捉"
    };
    let title = first.filter(|line| !line.is_empty()).unwrap_or(fallback);
    let clipped: String = title.chars().take(MAX_TITLE_CHARS).collect();
    let suffix = if title.chars().count() > MAX_TITLE_CHARS {
        "…"
    } else {
        ""
    };
    format!("{}{suffix}", clipped.trim())
}

/// 组合 frontmatter + 原文 + 链接 + 图片 + 标签；正文保持用户输入原样。
pub fn capture_markdown(title: &str, input: &CaptureInputDto, image: Option<&str>) -> String {
    let mut blocks = Vec::new();
    if !input.text.trim().is_empty() {
        // 捕获框里输入的原始文本原样保留（含缩进与首尾换行），编辑体验优先于自动整形。
        blocks.push(input.text.clone());
    }
    if let Some(link) = input
        .link
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
    {
        blocks.push(link.to_string());
    }
    if let Some(image) = image.filter(|v| !v.is_empty()) {
        blocks.push(image.to_string());
    }
    let tags = normalized_tags(&input.tags);
    if !tags.is_empty() {
        blocks.push(
            tags.into_iter()
                .map(|tag| format!("#{tag}"))
                .collect::<Vec<_>>()
                .join(" "),
        );
    }
    let body = blocks.join("\n\n");
    format!(
        "---\ntitle: '{}'\n---\n\n{body}\n",
        yaml_single_quote(title)
    )
}

fn normalized_tags(tags: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for raw in tags {
        let tag = raw.trim().trim_start_matches('#').to_lowercase();
        let cleaned: String = tag
            .chars()
            .filter(|c| c.is_alphanumeric() || matches!(c, '_' | '-' | '/'))
            .take(MAX_TAG_CHARS)
            .collect();
        if !cleaned.is_empty() && !out.contains(&cleaned) {
            out.push(cleaned);
        }
        if out.len() >= MAX_TAGS {
            break;
        }
    }
    out
}

pub fn unique_capture_path(root: &Path, title: &str) -> String {
    let stamp = OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(format_description!(
            "[year]-[month]-[day]-[hour][minute][second]"
        ))
        .unwrap_or_else(|_| "capture".to_string());
    let slug = slugify(title);
    let base = format!("inbox/{stamp}-{slug}");
    let mut candidate = format!("{base}.md");
    let mut index = 2;
    while root.join(&candidate).exists() {
        candidate = format!("{base}-{index}.md");
        index += 1;
    }
    candidate
}

/// 文件名安全标题：保留 CJK/字母数字，空白与标点折叠为 `-`。
pub fn slugify(title: &str) -> String {
    let mut slug = String::new();
    let mut dash = false;
    for ch in title.chars() {
        if ch.is_alphanumeric() {
            slug.push(ch.to_lowercase().next().unwrap_or(ch));
            dash = false;
        } else if !slug.is_empty() && !dash {
            slug.push('-');
            dash = true;
        }
        if slug.chars().count() >= MAX_SLUG_CHARS {
            break;
        }
    }
    let trimmed = slug.trim_matches('-');
    if trimmed.is_empty() {
        "capture".to_string()
    } else {
        trimmed.to_string()
    }
}

fn yaml_single_quote(value: &str) -> String {
    value.replace('\'', "''")
}

pub fn markdown_alt(value: &str) -> String {
    value.replace('[', "\\[").replace(']', "\\]")
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn input(text: &str) -> CaptureInputDto {
        CaptureInputDto {
            text: text.into(),
            tags: vec!["Project".into(), "#项目".into(), "project".into()],
            link: Some("https://example.com".into()),
            share_intake_id: None,
        }
    }

    #[test]
    fn title_uses_first_non_empty_line_and_falls_back() {
        assert_eq!(capture_title("\n  第一行\n第二行", false, None), "第一行");
        assert_eq!(capture_title("   ", true, None), "图片捕捉");
        assert_eq!(capture_title("", false, Some("https://a")), "链接捕捉");
    }

    #[test]
    fn markdown_keeps_body_and_appends_link_tags() {
        let markdown = capture_markdown("标题", &input("正文"), None);
        assert!(markdown.starts_with("---\ntitle: '标题'\n---\n\n正文"));
        assert!(markdown.contains("https://example.com"));
        assert!(markdown.contains("#project #项目"));
        assert!(!markdown.contains("#Project"));

        let raw = "  缩进正文\n末行保留  \n";
        let markdown = capture_markdown("标题", &input(raw), None);
        assert!(markdown.starts_with(&format!("---\ntitle: '标题'\n---\n\n{raw}")));
    }

    #[test]
    fn slug_is_safe_and_collision_free() {
        assert_eq!(slugify("Hello, 世界 / Test"), "hello-世界-test");
        let tmp = tempfile::tempdir().unwrap();
        fs::create_dir_all(tmp.path().join("inbox")).unwrap();
        let first = unique_capture_path(tmp.path(), "同名");
        fs::write(tmp.path().join(&first), "x").unwrap();
        let second = unique_capture_path(tmp.path(), "同名");
        assert_ne!(first, second);
        assert!(second.ends_with("-2.md"));
    }
}
