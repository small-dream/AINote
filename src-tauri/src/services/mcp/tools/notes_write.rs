//! 写工具：新建、整篇覆盖、追加与精确片段替换。

use std::path::Path;

use serde_json::{json, Value};

use crate::repositories::note_files;
use crate::services::{note_content, note_service};

use super::{
    args, check_revision, current_revision, file_stem, invalid, map_app_error, normalize_dir,
    normalize_path, normalize_slashes, title_stem, write_call, ToolCall, ToolError,
    MAX_CONTENT_BYTES, MAX_OLD_BYTES,
};

pub(super) fn create_note(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let raw_path = args::optional_str(object, "path")?;
    let title = args::optional_str(object, "title")?;
    let content = args::optional_text(object, "content", MAX_CONTENT_BYTES)?;
    let directory = normalize_dir(args::optional_str(object, "directory")?)?;

    let path = match raw_path {
        Some(raw) => normalize_path(raw, true)?,
        None => {
            let title = title.ok_or_else(|| invalid("path or title is required"))?;
            let stem = title_stem(title)?;
            let candidate = format!("{stem}.md");
            normalize_slashes(
                &note_files::unique_note_path(root, &directory, &candidate)
                    .map_err(|err| map_app_error(&err))?,
            )
        }
    };
    let display_title = title
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| file_stem(&path));
    let body = content.unwrap_or_else(|| format!("# {display_title}\n"));
    note_content::write_text_new(root, &path, &body).map_err(|err| map_app_error(&err))?;
    let meta = note_service::meta_of(root, &path).map_err(|err| map_app_error(&err))?;
    Ok(write_call(&path, &meta, &body))
}

pub(super) fn update_note(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let path = normalize_path(args::required_str(object, "path")?, true)?;
    let content = args::required_text(object, "content", MAX_CONTENT_BYTES)?;
    let expected = args::optional_str(object, "expectedRevision")?;
    let (current, _) = current_revision(root, &path)?;
    check_revision(expected, &current)?;
    note_service::update_note(root, &path, &content).map_err(|err| map_app_error(&err))?;
    let meta = note_service::meta_of(root, &path).map_err(|err| map_app_error(&err))?;
    Ok(write_call(&path, &meta, &content))
}

pub(super) fn append_note(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let path = normalize_path(args::required_str(object, "path")?, true)?;
    let content = args::required_text(object, "content", MAX_CONTENT_BYTES)?;
    let expected = args::optional_str(object, "expectedRevision")?;
    let (current, _) = current_revision(root, &path)?;
    check_revision(expected, &current)?;
    let mut next = current;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(&content);
    note_service::update_note(root, &path, &next).map_err(|err| map_app_error(&err))?;
    let meta = note_service::meta_of(root, &path).map_err(|err| map_app_error(&err))?;
    Ok(write_call(&path, &meta, &next))
}

pub(super) fn patch_note(root: &Path, arguments: &Value) -> Result<ToolCall, ToolError> {
    let object = args::object(arguments)?;
    let path = normalize_path(args::required_str(object, "path")?, true)?;
    let old_text = args::required_text(object, "oldText", MAX_OLD_BYTES)?;
    if old_text.is_empty() {
        return Err(invalid("oldText must not be empty"));
    }
    let new_text = args::required_text(object, "newText", MAX_CONTENT_BYTES)?;
    let expected = args::optional_str(object, "expectedRevision")?;
    let replace_all = args::optional_bool(object, "replaceAll", false)?;
    let (current, _) = current_revision(root, &path)?;
    check_revision(expected, &current)?;
    let matches = current.matches(&old_text).count();
    if matches == 0 {
        return Err(ToolError::new(
            "MCP_PATCH_NOT_FOUND",
            "oldText was not found in the note. Read the note again and use an exact fragment.",
        ));
    }
    if matches > 1 && !replace_all {
        return Err(ToolError::new(
            "MCP_PATCH_AMBIGUOUS",
            "oldText appears more than once. Use a longer unique fragment or set replaceAll=true.",
        )
        .with_data(json!({ "matches": matches })));
    }
    let next = if replace_all {
        current.replace(&old_text, &new_text)
    } else {
        current.replacen(&old_text, &new_text, 1)
    };
    note_service::update_note(root, &path, &next).map_err(|err| map_app_error(&err))?;
    let meta = note_service::meta_of(root, &path).map_err(|err| map_app_error(&err))?;
    Ok(write_call(&path, &meta, &next))
}
