use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use crate::domain::error::AppError;
use crate::domain::note::{extract_title, NoteKind};
use crate::domain::rich_text;
use crate::domain::wiki::{UnlinkedMention, UnlinkedMentionRef};
use crate::repositories::{file_storage, note_files};
use crate::services::note_content;
use crate::services::wiki_mention_parser::{self, MentionHit};
use crate::services::wiki_parser;

/// 当前笔记的未链接提及：按需扫描全仓，不扩大常规 wiki_index。
pub fn unlinked_mentions(root: &Path, target: &str) -> Result<Vec<UnlinkedMention>, AppError> {
    let TargetInfo { terms, .. } = target_info(root, target)?;
    let mut out = Vec::new();
    for file in file_storage::collect_note_files(root)? {
        let rel = rel_path(root, &file)?;
        if rel == target {
            continue;
        }
        let Some((content, kind, title)) = read_note(root, &file)? else {
            continue;
        };
        let hits = scan(&content, kind, &terms)?;
        for hit in hits {
            out.push(UnlinkedMention {
                source_path: rel.clone(),
                source_title: title.clone(),
                term: hit.term,
                line: hit.line,
                snippet: hit.snippet,
                occurrence: hit.occurrence,
            });
            if out.len() >= 100 {
                return Ok(out);
            }
        }
    }
    Ok(out)
}

/// 批量转换：先验证全部来源，再逐文件降序替换；任一过期则整批不写。
pub fn convert_mentions(
    root: &Path,
    target: &str,
    refs: &[UnlinkedMentionRef],
) -> Result<usize, AppError> {
    let TargetInfo { title, terms, .. } = target_info(root, target)?;
    let link_name = safe_link_name(target, &title);
    let allowed: BTreeSet<String> = terms.iter().map(|term| term.to_lowercase()).collect();
    let replacement = format!("[[{link_name}]]");
    let mut grouped: BTreeMap<String, Vec<&UnlinkedMentionRef>> = BTreeMap::new();
    for item in refs {
        if !allowed.contains(&item.term.to_lowercase()) {
            return Err(AppError::WikiConflict(
                "提及目标已变化，请刷新后重试".into(),
            ));
        }
        grouped
            .entry(item.source_path.clone())
            .or_default()
            .push(item);
    }
    let mut prepared = Vec::new();
    let mut count = 0;
    for (source_path, items) in grouped {
        let source_rel = note_files::validate_rel_path(&source_path)?;
        let file = root.join(&source_rel);
        let Some((content, kind, _)) = read_note(root, &file)? else {
            return Err(AppError::WikiConflict("来源笔记不可读或已加密".into()));
        };
        let hits = scan(&content, kind, &terms)?;
        let mut selected = Vec::new();
        let mut selected_keys = BTreeSet::new();
        for item in items {
            let hit = hits
                .iter()
                .find(|hit| {
                    hit.term.eq_ignore_ascii_case(&item.term) && hit.occurrence == item.occurrence
                })
                .ok_or_else(|| AppError::WikiConflict("未链接提及已变化，请刷新后重试".into()))?;
            if selected_keys.insert((hit.term.to_lowercase(), hit.occurrence)) {
                selected.push(hit.clone());
            }
        }
        count += selected.len();
        let next = match kind {
            NoteKind::Markdown => {
                wiki_mention_parser::replace_markdown(&content, &selected, &replacement)
            }
            NoteKind::RichText => {
                wiki_mention_parser::replace_rich_text(&content, &selected, &replacement)?
            }
        };
        prepared.push((source_path, next));
    }
    for (path, content) in prepared {
        note_content::write_text(root, &path, &content)?;
    }
    Ok(count)
}

struct TargetInfo {
    title: String,
    terms: Vec<String>,
}

fn target_info(root: &Path, target: &str) -> Result<TargetInfo, AppError> {
    let path = note_files::validate_rel_path(target)?;
    let file = root.join(path);
    let Some((content, kind, fallback)) = read_note(root, &file)? else {
        return Err(AppError::NoteNotFound(target.to_string()));
    };
    let title = match kind {
        NoteKind::Markdown => extract_title(&content, &fallback),
        NoteKind::RichText => rich_text::extract_title(&content).unwrap_or(fallback),
    };
    let mut terms = vec![title.clone(), file_stem(&file)];
    if kind == NoteKind::Markdown {
        terms.extend(wiki_parser::extract_aliases(&content));
    }
    dedupe_terms(&mut terms);
    Ok(TargetInfo { title, terms })
}

fn dedupe_terms(terms: &mut Vec<String>) {
    let mut seen = BTreeSet::new();
    terms.retain(|term| {
        let trimmed = term.trim();
        !trimmed.is_empty() && trimmed.chars().count() >= 2 && seen.insert(trimmed.to_lowercase())
    });
    for term in terms.iter_mut() {
        *term = term.trim().to_string();
    }
}

fn read_note(root: &Path, file: &Path) -> Result<Option<(String, NoteKind, String)>, AppError> {
    let read = note_content::read_file(root, file)?;
    let Some(content) = read.text else {
        return Ok(None);
    };
    if read.encrypted {
        return Ok(None);
    }
    let kind = NoteKind::of_path(file).unwrap_or(NoteKind::Markdown);
    let fallback = file
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(Some((content, kind, fallback)))
}

fn scan(content: &str, kind: NoteKind, terms: &[String]) -> Result<Vec<MentionHit>, AppError> {
    match kind {
        NoteKind::Markdown => Ok(wiki_mention_parser::scan_markdown(content, terms)),
        NoteKind::RichText => wiki_mention_parser::scan_rich_text(content, terms),
    }
}

fn rel_path(root: &Path, file: &Path) -> Result<String, AppError> {
    file.strip_prefix(root)
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|error| AppError::Io(error.to_string()))
}

fn file_stem(file: &Path) -> String {
    file.file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn safe_link_name(target: &str, title: &str) -> String {
    if !title.contains(['#', '|', '[', ']']) {
        return title.to_string();
    }
    let path = PathBuf::from(target);
    file_stem(&path)
}
