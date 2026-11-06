//! 7 个笔记工具的实际文件操作。
//!
//! 这里不依赖 Tauri AppHandle，便于用 tempdir 做单测；仓库解析、写锁、草稿守卫与
//! UI 事件在上层 `executor.rs` 完成。

use std::path::Path;

use serde_json::{json, Value};
use sha2::{Digest, Sha256};

use crate::domain::note::NoteMeta;
use crate::repositories::{asset_files, note_files};
use crate::services::{note_service, search_service};

use super::{args, map_app_error, ToolCall, ToolError};

#[path = "notes_write.rs"]
mod notes_write;

pub(super) const MAX_CONTENT_BYTES: usize = 1024 * 1024;
pub(super) const MAX_OLD_BYTES: usize = 100 * 1024;
const MAX_PATH_CHARS: usize = 512;

pub fn execute(root: &Path, name: &str, arguments: &Value) -> Result<ToolCall, ToolError> {
    match name {
        "list_notes" => list_notes(root, arguments),
        "read_note" => read_note(root, arguments),
        "search_notes" => search_notes(root, arguments),
        "create_note" => notes_write::create_note(root, arguments),
        "update_note" => notes_write::update_note(root, arguments),
        "append_note" => notes_write::append_note(root, arguments),
        "patch_note" => notes_write::patch_note(root, arguments),
        _ => Err(ToolError::new("MCP_UNKNOWN_TOOL", "Unknown tool")),
    }
}

pub(super) fn invalid(message: impl Into<String>) -> ToolError {
    ToolError::new("MCP_INVALID_ARGUMENT", message)
}

fn revision_of(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    let bytes: &[u8] = digest.as_ref();
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

pub(super) fn normalize_slashes(value: &str) -> String {
    value.replace('\\', "/")
}

pub(super) fn normalize_path(raw: &str, write: bool) -> Result<String, ToolError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(invalid("path must not be empty"));
    }
    if trimmed.chars().count() > MAX_PATH_CHARS {
        return Err(invalid(format!("path exceeds {MAX_PATH_CHARS} characters")));
    }
    let normalized = normalize_slashes(trimmed);
    let path = Path::new(&normalized);
    let rel = if write {
        match path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref()
        {
            None => format!("{normalized}.md"),
            Some("md") => normalize_slashes(&path.with_extension("md").to_string_lossy()),
            Some("markdown") => normalize_slashes(
                &path.with_extension("md").to_string_lossy(),
            ),
            Some(_) => {
                return Err(ToolError::new(
                    "MCP_UNSUPPORTED_KIND",
                    "Only Markdown (.md) notes can be written through MCP.",
                ))
            }
        }
    } else {
        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_ascii_lowercase());
        if !matches!(extension.as_deref(), Some("md") | Some("ainote")) {
            return Err(ToolError::new(
                "MCP_UNSUPPORTED_KIND",
                "Only .md and .ainote notes can be read through MCP.",
            ));
        }
        normalized
    };
    note_files::validate_rel_path(&rel).map_err(|_| {
        ToolError::new(
            "MCP_INVALID_PATH",
            format!("Invalid repository-relative path: {raw}"),
        )
    })?;
    Ok(rel)
}

pub(super) fn normalize_dir(raw: Option<&str>) -> Result<String, ToolError> {
    let Some(raw) = raw else {
        return Ok(String::new());
    };
    let trimmed = raw.trim().replace('\\', "/");
    let trimmed = trimmed.trim_matches('/');
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    note_files::validate_rel_path(trimmed).map_err(|_| {
        ToolError::new(
            "MCP_INVALID_PATH",
            format!("Invalid repository-relative directory: {raw}"),
        )
    })?;
    Ok(trimmed.to_string())
}

pub(super) fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| "note".to_string())
}

pub(super) fn title_stem(title: &str) -> Result<String, ToolError> {
    let sanitized = asset_files::sanitize_file_name(title.trim());
    let stem = sanitized
        .strip_suffix(".md")
        .or_else(|| sanitized.strip_suffix(".markdown"))
        .unwrap_or(&sanitized)
        .trim_matches('.')
        .to_string();
    if stem.is_empty() {
        return Err(invalid("title must contain at least one usable character"));
    }
    Ok(stem)
}

pub(super) fn current_revision(root: &Path, path: &str) -> Result<(String, String), ToolError> {
    let read = note_service::read_note(root, path).map_err(|err| map_app_error(&err))?;
    if read.locked {
        return Err(ToolError::new(
            "MCP_VAULT_LOCKED",
            "The encrypted notes vault is locked. Ask the user to unlock it in AINote, then retry.",
        ));
    }
    Ok((read.content.clone(), revision_of(&read.content)))
}

pub(super) fn check_revision(expected: Option<&str>, current: &str) -> Result<(), ToolError> {
    let Some(expected) = expected else {
        return Ok(());
    };
    if expected == revision_of(current) {
        return Ok(());
    }
    Err(ToolError::new(
        "MCP_REVISION_CONFLICT",
        "The note changed since it was read. Read it again and retry with the new revision.",
    )
    .with_data(json!({ "currentRevision": revision_of(current) })))
}

fn note_json(meta: &NoteMeta) -> Value {
    json!({
        "path": normalize_slashes(&meta.path),
        "title": meta.title,
        "kind": meta.kind,
        "updatedAt": meta.updated_at,
        "encrypted": meta.encrypted,
    })
}

pub(super) fn write_call(path: &str, meta: &NoteMeta, content: &str) -> ToolCall {
    let structured = json!({
        "path": normalize_slashes(path),
        "title": meta.title,
        "revision": revision_of(content),
        "updatedAt": meta.updated_at,
        "bytes": content.len(),
    });
    ToolCall {
        text: structured.to_string(),
        structured,
    }
}

fn in_directory(path: &str, directory: &str) -> bool {
    if directory.is_empty() {
        return true;
    }
    let path = normalize_slashes(path);
    let directory = normalize_slashes(directory);
    path == directory || path.starts_with(&format!("{directory}/"))
}

fn list_notes(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let directory = normalize_dir(args::optional_str(object, "directory")?)?;
    let limit = args::optional_u64(object, "limit", 100, 1, 500)? as usize;
    let offset = args::optional_u64(object, "offset", 0, 0, 1_000_000)? as usize;
    let notes = note_service::list_notes(root).map_err(|err| map_app_error(&err))?;
    let mut filtered: Vec<NoteMeta> = notes
        .into_iter()
        .filter(|meta| in_directory(&meta.path, &directory))
        .collect();
    filtered.sort_by(|a, b| a.path.cmp(&b.path));
    let total = filtered.len();
    let has_more = offset.saturating_add(limit) < total;
    let page: Vec<Value> = filtered
        .into_iter()
        .skip(offset)
        .take(limit)
        .map(|meta| note_json(&meta))
        .collect();
    let structured = json!({ "notes": page, "total": total, "hasMore": has_more });
    Ok(ToolCall {
        text: structured.to_string(),
        structured,
    })
}

fn read_note(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let path = normalize_path(args::required_str(object, "path")?, false)?;
    let read = note_service::read_note(root, &path).map_err(|err| map_app_error(&err))?;
    if read.locked {
        return Err(ToolError::new(
            "MCP_VAULT_LOCKED",
            "The encrypted notes vault is locked. Ask the user to unlock it in AINote, then retry.",
        ));
    }
    let meta = note_service::meta_of(root, &path).map_err(|err| map_app_error(&err))?;
    let revision = revision_of(&read.content);
    let structured = json!({
        "path": normalize_slashes(&path),
        "title": meta.title,
        "kind": read.kind,
        "content": read.content,
        "revision": revision,
        "updatedAt": meta.updated_at,
        "encrypted": read.encrypted,
        "locked": false,
    });
    Ok(ToolCall {
        text: read.content,
        structured,
    })
}

fn search_notes(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let query = args::required_str(object, "query")?;
    if query.chars().count() > 100 {
        return Err(invalid("query exceeds 100 characters"));
    }
    let limit = args::optional_u64(object, "limit", 20, 1, 30)? as usize;
    let results = search_service::search_notes(root, query).map_err(|err| map_app_error(&err))?;
    let total = results.len();
    let page: Vec<Value> = results
        .into_iter()
        .take(limit)
        .map(|result| {
            json!({
                "path": normalize_slashes(&result.path),
                "title": result.title,
                "snippet": result.snippet,
                "line": result.line,
                "updatedAt": result.updated_at,
                "encrypted": result.encrypted,
            })
        })
        .collect();
    let structured = json!({ "results": page, "total": total });
    Ok(ToolCall {
        text: structured.to_string(),
        structured,
    })
}


#[cfg(test)]
#[path = "notes_tests.rs"]
mod notes_tests;
