use serde_json::json;

use super::*;
use crate::domain::note::NoteKind;
use crate::services::vault_service;

fn tmp() -> tempfile::TempDir {
    tempfile::tempdir().unwrap()
}

fn create_result(
    root: &Path,
    arguments: serde_json::Value,
) -> Result<ToolCall, super::ToolError> {
    execute(root, "create_note", &arguments)
}

fn create(root: &Path, arguments: serde_json::Value) -> ToolCall {
    create_result(root, arguments).unwrap()
}

#[test]
fn create_read_list_and_update_roundtrip() {
    let dir = tmp();
    let root = dir.path();
    let created = create(
        root,
        json!({ "path": "daily/demo.md", "content": "# Demo\n\nhello" }),
    );
    assert_eq!(created.structured["path"], "daily/demo.md");
    assert!(created.structured["revision"].as_str().unwrap().len() == 64);

    let read = execute(root, "read_note", &json!({ "path": "daily/demo.md" })).unwrap();
    assert_eq!(read.text, "# Demo\n\nhello");
    assert_eq!(read.structured["title"], "demo");
    let revision = read.structured["revision"].as_str().unwrap().to_string();

    let updated = execute(
        root,
        "update_note",
        &json!({ "path": "daily/demo.md", "content": "# Demo\n\nworld", "expectedRevision": revision }),
    )
    .unwrap();
    assert_ne!(updated.structured["revision"], revision);

    let list = execute(root, "list_notes", &json!({ "directory": "daily" })).unwrap();
    assert_eq!(list.structured["total"], 1);
    assert_eq!(list.structured["notes"][0]["path"], "daily/demo.md");
}

#[test]
fn revision_conflict_does_not_overwrite() {
    let dir = tmp();
    let root = dir.path();
    create(root, json!({ "path": "a.md", "content": "v1" }));
    let stale = execute(root, "read_note", &json!({ "path": "a.md" }))
        .unwrap()
        .structured["revision"]
        .as_str()
        .unwrap()
        .to_string();
    execute(root, "update_note", &json!({ "path": "a.md", "content": "v2" })).unwrap();
    let err = execute(
        root,
        "update_note",
        &json!({ "path": "a.md", "content": "v3", "expectedRevision": stale }),
    )
    .unwrap_err();
    assert_eq!(err.code, "MCP_REVISION_CONFLICT");
    assert_eq!(
        execute(root, "read_note", &json!({ "path": "a.md" }))
            .unwrap()
            .text,
        "v2"
    );
}

#[test]
fn append_and_patch_work_and_report_ambiguous_match() {
    let dir = tmp();
    let root = dir.path();
    create(root, json!({ "path": "a.md", "content": "alpha\nbeta" }));
    let appended = execute(
        root,
        "append_note",
        &json!({ "path": "a.md", "content": "gamma" }),
    )
    .unwrap();
    assert_eq!(appended.structured["bytes"], "alpha\nbeta\ngamma".len());

    let patched = execute(
        root,
        "patch_note",
        &json!({ "path": "a.md", "oldText": "beta", "newText": "BETA" }),
    )
    .unwrap();
    assert_eq!(patched.structured["path"], "a.md");
    assert_eq!(
        execute(root, "read_note", &json!({ "path": "a.md" }))
            .unwrap()
            .text,
        "alpha\nBETA\ngamma"
    );

    let ambiguous = execute(
        root,
        "patch_note",
        &json!({ "path": "a.md", "oldText": "a", "newText": "x" }),
    )
    .unwrap_err();
    assert_eq!(ambiguous.code, "MCP_PATCH_AMBIGUOUS");
    let missing = execute(
        root,
        "patch_note",
        &json!({ "path": "a.md", "oldText": "zzz", "newText": "x" }),
    )
    .unwrap_err();
    assert_eq!(missing.code, "MCP_PATCH_NOT_FOUND");
}

#[test]
fn create_derives_unique_title_path_and_defaults_heading() {
    let dir = tmp();
    let root = dir.path();
    let first = create(root, json!({ "title": "My Note" }));
    assert_eq!(first.structured["path"], "My_Note.md");
    assert_eq!(
        execute(root, "read_note", &json!({ "path": "My_Note.md" }))
            .unwrap()
            .text,
        "# My Note\n"
    );
    let second = create(root, json!({ "title": "My Note" }));
    assert_eq!(second.structured["path"], "My_Note-1.md");
}

#[test]
fn create_refuses_existing_path_and_traversal() {
    let dir = tmp();
    let root = dir.path();
    create(root, json!({ "path": "a.md", "content": "x" }));
    let err = create_result(root, json!({ "path": "a.md", "content": "y" })).unwrap_err();
    assert_eq!(err.code, "MCP_NOTE_EXISTS");
    for bad in ["../evil.md", ".hidden/a.md", "/abs/a.md", ""] {
        let err = create_result(root, json!({ "path": bad, "content": "x" })).unwrap_err();
        assert!(
            err.code == "MCP_INVALID_PATH" || err.code == "MCP_INVALID_ARGUMENT",
            "unexpected code for {bad}: {}",
            err.code
        );
    }
    let err = create_result(root, json!({ "path": "a.ainote", "content": "{}" })).unwrap_err();
    assert_eq!(err.code, "MCP_UNSUPPORTED_KIND");
    let read_err = execute(root, "read_note", &json!({ "path": "a.txt" })).unwrap_err();
    assert_eq!(read_err.code, "MCP_UNSUPPORTED_KIND");
}

#[test]
fn list_supports_pagination_and_search() {
    let dir = tmp();
    let root = dir.path();
    for index in 0..3 {
        create(
            root,
            json!({ "path": format!("n{index}.md"), "content": format!("rust {index}") }),
        );
    }
    let page = execute(root, "list_notes", &json!({ "limit": 2 })).unwrap();
    assert_eq!(page.structured["total"], 3);
    assert_eq!(page.structured["hasMore"], true);
    assert_eq!(page.structured["notes"].as_array().unwrap().len(), 2);
    let search = execute(root, "search_notes", &json!({ "query": "rust" })).unwrap();
    assert_eq!(search.structured["results"].as_array().unwrap().len(), 3);
}

#[test]
fn read_missing_note_is_a_tool_error() {
    let dir = tmp();
    let err = execute(dir.path(), "read_note", &json!({ "path": "nope.md" })).unwrap_err();
    assert_eq!(err.code, "MCP_NOTE_NOT_FOUND");
}

#[test]
fn encrypted_note_requires_unlock_and_stays_encrypted_after_write() {
    let _serial = vault_service::test_guard();
    let dir = tmp();
    let root = dir.path();
    vault_service::create(root, "correct horse battery").unwrap();
    note_service::create_note(
        root,
        "secret.md",
        NoteKind::Markdown,
        Some("# Secret\noriginal"),
    )
    .unwrap();
    note_service::set_note_encryption(root, "secret.md", true).unwrap();
    vault_service::lock(root).unwrap();

    let locked = execute(root, "read_note", &json!({ "path": "secret.md" })).unwrap_err();
    assert_eq!(locked.code, "MCP_VAULT_LOCKED");
    let write_locked = execute(
        root,
        "update_note",
        &json!({ "path": "secret.md", "content": "# Secret\nchanged" }),
    )
    .unwrap_err();
    assert_eq!(write_locked.code, "MCP_VAULT_LOCKED");

    vault_service::unlock(root, "correct horse battery").unwrap();
    let read = execute(root, "read_note", &json!({ "path": "secret.md" })).unwrap();
    assert_eq!(read.text, "# Secret\noriginal");
    execute(
        root,
        "update_note",
        &json!({ "path": "secret.md", "content": "# Secret\nchanged" }),
    )
    .unwrap();
    assert!(std::fs::read_to_string(root.join("secret.md"))
        .unwrap()
        .starts_with("AINOTE-ENC-v1"));
    vault_service::lock(root).unwrap();
}
