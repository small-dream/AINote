//! 7 个笔记工具的 JSON Schema 与注解（作为对外契约；参数由 args.rs 手写校验）。

use serde_json::{json, Value};

use super::ToolSpec;

fn object(properties: Value, required: &[&str]) -> Value {
    json!({
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false,
    })
}

fn annotations(
    title: &str,
    read_only: bool,
    destructive: bool,
    idempotent: bool,
) -> Value {
    json!({
        "title": title,
        "readOnlyHint": read_only,
        "destructiveHint": destructive,
        "idempotentHint": idempotent,
        "openWorldHint": false,
    })
}

fn path_property() -> Value {
    json!({
        "type": "string",
        "description": "Repository-relative note path, e.g. 'daily/2026-11-06.md'.",
        "minLength": 1,
        "maxLength": 512,
    })
}

fn revision_property() -> Value {
    json!({
        "type": "string",
        "description": "Optional revision returned by read_note. When supplied, the write is rejected if the note changed.",
    })
}

fn note_summary_output() -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "title": {"type": "string"},
            "kind": {"type": "string"},
            "updatedAt": {"type": "number"},
            "encrypted": {"type": "boolean"}
        },
        "required": ["path", "title", "kind", "updatedAt", "encrypted"],
    })
}

fn write_output() -> Value {
    json!({
        "type": "object",
        "properties": {
            "path": {"type": "string"},
            "title": {"type": "string"},
            "revision": {"type": "string"},
            "updatedAt": {"type": "number"},
            "bytes": {"type": "number"}
        },
        "required": ["path", "title", "revision", "updatedAt", "bytes"],
    })
}

pub fn specs() -> Vec<ToolSpec> {
    vec![
        ToolSpec {
            name: "list_notes",
            title: "List notes",
            description: "List Markdown and rich-text notes in the active AINote repository. Supports an optional directory prefix and pagination.",
            writes: false,
            input_schema: object(
                json!({
                    "directory": {"type": "string", "description": "Optional repository-relative directory prefix, e.g. 'daily'."},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100},
                    "offset": {"type": "integer", "minimum": 0, "default": 0}
                }),
                &[],
            ),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "notes": {"type": "array", "items": note_summary_output()},
                    "total": {"type": "number"},
                    "hasMore": {"type": "boolean"}
                },
                "required": ["notes", "total", "hasMore"],
            })),
            annotations: annotations("List notes", true, false, true),
        },
        ToolSpec {
            name: "read_note",
            title: "Read note",
            description: "Read a note's full content and revision. Use the revision as expectedRevision when writing.",
            writes: false,
            input_schema: object(json!({ "path": path_property() }), &["path"]),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "title": {"type": "string"},
                    "kind": {"type": "string"},
                    "content": {"type": "string"},
                    "revision": {"type": "string"},
                    "updatedAt": {"type": "number"},
                    "encrypted": {"type": "boolean"},
                    "locked": {"type": "boolean"}
                },
                "required": ["path", "title", "kind", "content", "revision", "updatedAt", "encrypted", "locked"],
            })),
            annotations: annotations("Read note", true, false, true),
        },
        ToolSpec {
            name: "search_notes",
            title: "Search notes",
            description: "Full-text search across note titles, paths and bodies in the active repository.",
            writes: false,
            input_schema: object(
                json!({
                    "query": {"type": "string", "minLength": 1, "maxLength": 100},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 30, "default": 20}
                }),
                &["query"],
            ),
            output_schema: Some(json!({
                "type": "object",
                "properties": {
                    "results": {"type": "array", "items": json!({
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "title": {"type": "string"},
                            "snippet": {"type": "string"},
                            "line": {"type": "number"},
                            "updatedAt": {"type": "number"},
                            "encrypted": {"type": "boolean"}
                        }
                    })},
                    "total": {"type": "number"}
                },
                "required": ["results", "total"],
            })),
            annotations: annotations("Search notes", true, false, true),
        },
        ToolSpec {
            name: "create_note",
            title: "Create note",
            description: "Create a new Markdown note. Fails if the explicit path already exists. Without a path, a unique file name is derived from title.",
            writes: true,
            input_schema: object(
                json!({
                    "path": {"type": "string", "description": "Optional repository-relative .md path."},
                    "title": {"type": "string", "description": "Optional display title used for the file name and default heading."},
                    "content": {"type": "string", "description": "Optional Markdown body; defaults to '# <title>'."},
                    "directory": {"type": "string", "description": "Optional target directory when path is omitted."}
                }),
                &[],
            ),
            output_schema: Some(write_output()),
            annotations: annotations("Create note", false, false, false),
        },
        ToolSpec {
            name: "update_note",
            title: "Update note",
            description: "Replace the entire content of an existing Markdown note. Preserve frontmatter and use expectedRevision to avoid overwriting concurrent edits.",
            writes: true,
            input_schema: object(
                json!({
                    "path": path_property(),
                    "content": {"type": "string"},
                    "expectedRevision": revision_property()
                }),
                &["path", "content"],
            ),
            output_schema: Some(write_output()),
            annotations: annotations("Update note", false, true, false),
        },
        ToolSpec {
            name: "append_note",
            title: "Append to note",
            description: "Append content to the end of an existing Markdown note, inserting a newline separator when needed.",
            writes: true,
            input_schema: object(
                json!({
                    "path": path_property(),
                    "content": {"type": "string"},
                    "expectedRevision": revision_property()
                }),
                &["path", "content"],
            ),
            output_schema: Some(write_output()),
            annotations: annotations("Append to note", false, true, false),
        },
        ToolSpec {
            name: "patch_note",
            title: "Patch note",
            description: "Replace an exact text fragment in an existing Markdown note. Fails when the fragment is missing or ambiguous unless replaceAll is true.",
            writes: true,
            input_schema: object(
                json!({
                    "path": path_property(),
                    "oldText": {"type": "string", "minLength": 1},
                    "newText": {"type": "string"},
                    "expectedRevision": revision_property(),
                    "replaceAll": {"type": "boolean", "default": false}
                }),
                &["path", "oldText", "newText"],
            ),
            output_schema: Some(write_output()),
            annotations: annotations("Patch note", false, true, false),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn specs_are_well_formed_and_unique() {
        let specs = specs();
        assert_eq!(specs.len(), 7);
        let mut names = std::collections::HashSet::new();
        for spec in &specs {
            assert!(names.insert(spec.name), "duplicate tool {}", spec.name);
            assert!(!spec.description.is_empty());
            assert_eq!(spec.input_schema["type"], "object");
            assert!(spec.input_schema.get("properties").is_some());
            assert!(spec.output_schema.is_some());
            let _ = tool_name_valid(spec.name);
        }
    }

    fn tool_name_valid(name: &str) -> bool {
        !name.is_empty()
            && name.len() <= 128
            && name
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    }
}
