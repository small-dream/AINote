use super::*;

#[test]
fn markdown_skips_code_links_and_existing_wikilinks() {
    let text =
        "项目计划\n`项目计划`\n```\n项目计划\n```\n[项目计划](https://x)\n[[项目计划]]\n项目计划";
    let hits = scan_markdown(text, &["项目计划".into()]);
    assert_eq!(hits.len(), 2);
    assert_eq!(hits[0].line, 1);
    assert_eq!(hits[1].line, 8);
}

#[test]
fn replacements_apply_from_end_and_rich_text_nodes() {
    let hits = scan_markdown("A 项目计划 B 项目计划", &["项目计划".into()]);
    let replaced = replace_markdown("A 项目计划 B 项目计划", &hits, "[[P]]");
    assert_eq!(replaced, "A [[P]] B [[P]]");

    let json = r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"项目计划"}]},{"type":"codeBlock","content":[{"type":"text","text":"项目计划"}]}]}"#;
    let hits = scan_rich_text(json, &["项目计划".into()]).unwrap();
    assert_eq!(hits.len(), 1);
    let replaced = replace_rich_text(json, &hits, "[[P]]").unwrap();
    assert!(replaced.contains("[[P]]"));
    assert!(replaced.contains("codeBlock"));
}

#[test]
fn rich_text_replaces_multiple_hits_in_one_node_from_the_end() {
    let json = r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"项目计划与项目计划"}]}]}"#;
    let hits = scan_rich_text(json, &["项目计划".into()]).unwrap();
    assert_eq!(hits.len(), 2);
    let replaced = replace_rich_text(json, &hits, "[[P]]").unwrap();
    assert!(replaced.contains("[[P]]与[[P]]"));
}

#[test]
fn terms_use_longest_match_and_word_boundaries() {
    let hits = scan_markdown(
        "Project Plan 与 Planner",
        &["Plan".into(), "Project Plan".into()],
    );
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].term, "Project Plan");
    assert_eq!(hits[0].start, 0);
    assert_eq!(hits[0].end, "Project Plan".len());

    let hits = scan_markdown("Plan 与 Planner", &["Plan".into()]);
    assert_eq!(hits.len(), 1);
}

#[test]
fn fence_marker_lines_are_not_scanned() {
    let hits = scan_markdown("```rust\nlet rust = true;\n```\nrust", &["rust".into()]);
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].line, 4);
}
