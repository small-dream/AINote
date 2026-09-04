//! 手动性能基准：运行 `cargo test perf_baseline -- --ignored --nocapture`。
//! 基准只输出耗时，不把机器差异写死成 CI 阈值。

#[cfg(test)]
mod tests {
    use std::time::Instant;

    use crate::services::{note_service, search_service, wiki_service};

    fn write_fixture(root: &std::path::Path, count: usize) {
        for index in 0..count {
            let path = format!("notes/{index:04}.md");
            note_service::update_note(root, &path, &format!("# Note {index}\n\n#tag-{index}\ncontent {index}"))
                .unwrap();
        }
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_1000_notes_search_and_first_index() {
        let fixture = tempfile::tempdir().unwrap();
        write_fixture(fixture.path(), 1_000);

        let search_started = Instant::now();
        let results = search_service::search_notes(fixture.path(), "content 999").unwrap();
        let search_ms = search_started.elapsed().as_secs_f64() * 1_000.0;

        let index_started = Instant::now();
        let index = wiki_service::wiki_index(fixture.path()).unwrap();
        let index_ms = index_started.elapsed().as_secs_f64() * 1_000.0;

        assert_eq!(results.len(), 1);
        assert_eq!(index.len(), 1_000);
        eprintln!("AINote baseline: search_1000={search_ms:.1}ms first_wiki_index_1000={index_ms:.1}ms");
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_5000_line_note_read() {
        let fixture = tempfile::tempdir().unwrap();
        let content = (0..5_000).map(|line| format!("line {line}\n")).collect::<String>();
        let started = Instant::now();
        note_service::update_note(fixture.path(), "large.md", &content).unwrap();
        let read = note_service::read_note(fixture.path(), "large.md").unwrap();
        let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
        assert_eq!(read.content.lines().count(), 5_000);
        eprintln!("AINote baseline: write_read_5000_lines={elapsed_ms:.1}ms");
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_batch_import_1000_notes() {
        let fixture = tempfile::tempdir().unwrap();
        let started = Instant::now();
        for index in 0..1_000 {
            note_service::import_note(fixture.path(), "imports", &format!("note-{index}.md"), "# Imported\n")
                .unwrap();
        }
        let elapsed_ms = started.elapsed().as_secs_f64() * 1_000.0;
        assert_eq!(note_service::list_notes(fixture.path()).unwrap().len(), 1_000);
        eprintln!("AINote baseline: batch_import_1000={elapsed_ms:.1}ms");
    }
}
