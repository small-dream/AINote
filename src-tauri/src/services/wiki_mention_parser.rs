use std::cmp::Reverse;
use std::collections::{BTreeMap, HashMap};

use regex::RegexBuilder;
use serde_json::Value;

use crate::domain::error::AppError;
use crate::services::wiki_mention_mask::{mask_inline, mask_markdown};

const MAX_MENTIONS: usize = 100;

#[derive(Debug, Clone)]
pub struct MentionHit {
    pub term: String,
    pub occurrence: usize,
    pub line: usize,
    pub snippet: String,
    pub start: usize,
    pub end: usize,
    /// Some(path) 表示 TipTap JSON 文本节点；None 表示 Markdown 原始字节区间。
    pub node_path: Option<Vec<usize>>,
}

pub fn scan_markdown(content: &str, terms: &[String]) -> Vec<MentionHit> {
    let masked = mask_markdown(content);
    scan_text(content, &masked, terms, None)
}

pub fn scan_rich_text(content: &str, terms: &[String]) -> Result<Vec<MentionHit>, AppError> {
    let value: Value = serde_json::from_str(content)
        .map_err(|_| AppError::WikiConflict("富文本内容无法解析".into()))?;
    let mut nodes = Vec::new();
    collect_text_nodes(&value, &mut Vec::new(), false, &mut nodes);
    let mut hits = Vec::new();
    for (line_index, (path, text)) in nodes.into_iter().enumerate() {
        let masked = mask_inline(&text);
        let mut found = scan_text(&text, &masked, terms, Some(path));
        for hit in &mut found {
            hit.line = line_index + 1;
        }
        hits.extend(found);
        if hits.len() >= MAX_MENTIONS {
            break;
        }
    }
    assign_occurrences(&mut hits);
    hits.truncate(MAX_MENTIONS);
    Ok(hits)
}

pub fn replace_markdown(content: &str, hits: &[MentionHit], replacement: &str) -> String {
    let mut ranges: Vec<(usize, usize)> = hits
        .iter()
        .filter(|hit| hit.node_path.is_none())
        .map(|hit| (hit.start, hit.end))
        .collect();
    ranges.sort_by(|a, b| b.0.cmp(&a.0));
    let mut out = content.to_string();
    for (start, end) in ranges {
        out.replace_range(start..end, replacement);
    }
    out
}

pub fn replace_rich_text(
    content: &str,
    hits: &[MentionHit],
    replacement: &str,
) -> Result<String, AppError> {
    let mut value: Value = serde_json::from_str(content)
        .map_err(|_| AppError::WikiConflict("富文本内容无法解析".into()))?;
    let mut grouped: BTreeMap<Vec<usize>, Vec<&MentionHit>> = BTreeMap::new();
    for hit in hits {
        let Some(path) = hit.node_path.as_ref() else {
            continue;
        };
        grouped.entry(path.clone()).or_default().push(hit);
    }
    for (path, mut node_hits) in grouped {
        // 同一文本节点可能有多个命中：必须从后往前替换，前面命中的字节区间才仍然有效。
        node_hits.sort_by(|left, right| right.start.cmp(&left.start));
        let node = node_at_mut(&mut value, &path)
            .ok_or_else(|| AppError::WikiConflict("富文本提及位置已变化".into()))?;
        let original = node
            .get("text")
            .and_then(|value| value.as_str())
            .ok_or_else(|| AppError::WikiConflict("富文本提及位置已变化".into()))?
            .to_string();
        if node_hits
            .iter()
            .any(|hit| hit.start >= hit.end || hit.end > original.len())
        {
            return Err(AppError::WikiConflict("富文本提及位置已变化".into()));
        }
        let mut next = original;
        for hit in node_hits {
            next.replace_range(hit.start..hit.end, replacement);
        }
        node["text"] = Value::String(next);
    }
    serde_json::to_string(&value).map_err(|error| AppError::WikiConflict(error.to_string()))
}

fn scan_text(
    original: &str,
    masked: &[u8],
    terms: &[String],
    node_path: Option<Vec<usize>>,
) -> Vec<MentionHit> {
    let mut candidates: Vec<&String> = terms
        .iter()
        .filter(|term| term.trim().chars().count() >= 2)
        .collect();
    // 正则的 alternation 取首个匹配分支；长词优先，避免“项目计划”被“项目”截断。
    candidates.sort_by_key(|term| Reverse(term.chars().count()));
    let pattern = candidates
        .into_iter()
        .map(|term| regex::escape(term))
        .collect::<Vec<_>>()
        .join("|");
    if pattern.is_empty() {
        return Vec::new();
    }
    let Ok(regex) = RegexBuilder::new(&pattern).case_insensitive(true).build() else {
        return Vec::new();
    };
    let Ok(masked_text) = std::str::from_utf8(masked) else {
        return Vec::new();
    };
    let mut hits = Vec::new();
    for found in regex.find_iter(masked_text) {
        if found.start() >= original.len() || found.end() > original.len() {
            continue;
        }
        let matched = &original[found.start()..found.end()];
        if !boundary_ok(original, found.start(), found.end(), matched) {
            continue;
        }
        let term = terms
            .iter()
            .find(|term| term.to_lowercase() == matched.to_lowercase())
            .cloned()
            .unwrap_or_else(|| matched.to_string());
        let line = line_of(original, found.start());
        hits.push(MentionHit {
            term,
            occurrence: 0,
            line,
            snippet: snippet_of_line(original, line),
            start: found.start(),
            end: found.end(),
            node_path: node_path.clone(),
        });
        if hits.len() >= MAX_MENTIONS {
            break;
        }
    }
    assign_occurrences(&mut hits);
    hits
}

fn boundary_ok(text: &str, start: usize, end: usize, matched: &str) -> bool {
    if matched.is_ascii() {
        let before = text[..start].chars().next_back();
        let after = text[end..].chars().next();
        return !before.is_some_and(is_word) && !after.is_some_and(is_word);
    }
    true
}

fn is_word(ch: char) -> bool {
    ch.is_alphanumeric() || ch == '_'
}

fn assign_occurrences(hits: &mut [MentionHit]) {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for hit in hits {
        let count = counts.entry(hit.term.to_lowercase()).or_insert(0);
        hit.occurrence = *count;
        *count += 1;
    }
}

fn line_of(text: &str, byte: usize) -> usize {
    1 + text[..byte].bytes().filter(|b| *b == b'\n').count()
}

fn snippet_of_line(text: &str, line: usize) -> String {
    let raw = text
        .lines()
        .nth(line.saturating_sub(1))
        .unwrap_or("")
        .trim();
    let clipped: String = raw.chars().take(119).collect();
    if raw.chars().count() > 119 {
        format!("{clipped}…")
    } else {
        clipped
    }
}

fn collect_text_nodes(
    node: &Value,
    path: &mut Vec<usize>,
    in_code: bool,
    out: &mut Vec<(Vec<usize>, String)>,
) {
    match node {
        Value::Array(items) => {
            for (index, child) in items.iter().enumerate() {
                path.push(index);
                collect_text_nodes(child, path, in_code, out);
                path.pop();
            }
        }
        Value::Object(map) => {
            let node_type = map.get("type").and_then(|v| v.as_str()).unwrap_or("");
            let in_code = in_code || node_type == "codeBlock";
            if node_type == "text" && !in_code {
                if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                    out.push((path.clone(), text.to_string()));
                }
            }
            if let Some(content) = map.get("content").and_then(|v| v.as_array()) {
                for (index, child) in content.iter().enumerate() {
                    path.push(index);
                    collect_text_nodes(child, path, in_code, out);
                    path.pop();
                }
            }
        }
        _ => {}
    }
}

fn node_at_mut<'a>(value: &'a mut Value, path: &[usize]) -> Option<&'a mut Value> {
    let mut current = value;
    for index in path {
        current = current
            .get_mut("content")?
            .as_array_mut()?
            .get_mut(*index)?;
    }
    Some(current)
}

#[cfg(test)]
#[path = "wiki_mention_parser_tests.rs"]
mod tests;
