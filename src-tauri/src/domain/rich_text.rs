use serde_json::Value;

/// 富文本（TipTap JSON）的纯文本/标题提取与默认模板。
/// 零业务依赖，供 note/search/wiki 各层复用。

/// 新建富文本笔记的默认模板：一级标题「未命名」+ 空段落。
pub fn default_template() -> String {
    serde_json::json!({
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": { "level": 1 },
                "content": [{ "type": "text", "text": "未命名" }],
            },
            { "type": "paragraph" },
        ],
    })
    .to_string()
}

/// 递归收集全部 text 节点文本（每个文本节点后换行），供全文搜索与标签/双链提取。
pub fn plain_text(json: &str) -> String {
    let Ok(value) = serde_json::from_str::<Value>(json) else {
        return String::new();
    };
    let mut out = String::new();
    collect_text(&value, &mut out);
    out
}

/// 提取首个一级标题文本；无一级标题时回退首个任意标题。
pub fn extract_title(json: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(json).ok()?;
    let mut fallback = None;
    value
        .get("content")
        .and_then(|c| first_heading(c, &mut fallback, 1))
        .or(fallback)
}

fn collect_text(node: &Value, out: &mut String) {
    match node {
        Value::Array(items) => {
            for item in items {
                collect_text(item, out);
            }
        }
        Value::Object(map) => {
            if map.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = map.get("text").and_then(|t| t.as_str()) {
                    out.push_str(text);
                    out.push('\n');
                    return;
                }
            }
            if let Some(content) = map.get("content") {
                collect_text(content, out);
            }
        }
        _ => {}
    }
}

fn first_heading(node: &Value, fallback: &mut Option<String>, target_level: u64) -> Option<String> {
    match node {
        Value::Array(items) => {
            for item in items {
                if let Some(found) = first_heading(item, fallback, target_level) {
                    return Some(found);
                }
            }
            None
        }
        Value::Object(map) => {
            if map.get("type").and_then(|t| t.as_str()) == Some("heading") {
                let level = map
                    .get("attrs")
                    .and_then(|a| a.get("level"))
                    .and_then(|l| l.as_u64())
                    .unwrap_or(1);
                let text = heading_text(map.get("content"));
                if fallback.is_none() {
                    *fallback = text.clone();
                }
                if level == target_level {
                    return text;
                }
            }
            if let Some(content) = map.get("content") {
                if let Some(found) = first_heading(content, fallback, target_level) {
                    return Some(found);
                }
            }
            None
        }
        _ => None,
    }
}

fn heading_text(content: Option<&Value>) -> Option<String> {
    let mut out = String::new();
    if let Some(node) = content {
        collect_text(node, &mut out);
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(json: &str) -> String {
        json.to_string()
    }

    #[test]
    fn plain_text_collects_text_nodes() {
        let json = doc(r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"标题"}]},{"type":"paragraph","content":[{"type":"text","text":"正文 A"},{"type":"text","text":"正文 B"}]}]}"#);
        let text = plain_text(&json);
        assert!(text.contains("标题"));
        assert!(text.contains("正文 A"));
        assert!(text.contains("正文 B"));
    }

    #[test]
    fn plain_text_returns_empty_for_invalid_json() {
        assert_eq!(plain_text("not json"), "");
    }

    #[test]
    fn extract_title_prefers_level_one_heading() {
        let json = doc(r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"二级"}]},{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"一级"}]}]}"#);
        assert_eq!(extract_title(&json).as_deref(), Some("一级"));
    }

    #[test]
    fn extract_title_falls_back_to_first_heading() {
        let json = doc(r#"{"type":"doc","content":[{"type":"paragraph"},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"三级"}]}]}"#);
        assert_eq!(extract_title(&json).as_deref(), Some("三级"));
    }

    #[test]
    fn extract_title_none_without_heading() {
        let json = doc(r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"正文"}]}]}"#);
        assert_eq!(extract_title(&json), None);
    }

    #[test]
    fn templates_are_valid_doc_json() {
        let value: Value = serde_json::from_str(&default_template()).unwrap();
        assert_eq!(value["type"], "doc");
    }
}
