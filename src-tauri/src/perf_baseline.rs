//! 手动性能基准：运行 `pnpm perf:baseline`（Rust 部分为 `cargo test perf_baseline -- --ignored --nocapture`）。
//! 基准只输出耗时，不把机器差异写死成 CI 阈值；结果记录见 `docs/PERF_BASELINE.md`。

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::time::Instant;

    use crate::repositories::git2_backend::Git2Backend;
    use crate::repositories::git_backend::GitBackend;
    use crate::services::{asset_service, note_service, search_service, sync_service, wiki_service};

    fn write_fixture(root: &Path, count: usize) {
        for index in 0..count {
            let path = format!("notes/{index:04}.md");
            note_service::update_note(root, &path, &format!("# Note {index}\n\n#tag-{index}\ncontent {index}"))
                .unwrap();
        }
    }

    fn ms(started: Instant) -> f64 {
        started.elapsed().as_secs_f64() * 1_000.0
    }

    fn init_repo_with_commits(root: &Path, commits: usize) {
        git2::Repository::init(root).unwrap();
        let backend = Git2Backend;
        for index in 0..commits {
            std::fs::write(root.join(format!("commit-{index:04}.md")), format!("{index}\n")).unwrap();
            backend
                .commit_all(root.to_str().unwrap(), &format!("perf {index}"))
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
        let search_ms = ms(search_started);

        let index_started = Instant::now();
        let index = wiki_service::wiki_index(fixture.path()).unwrap();
        let index_ms = ms(index_started);

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
        let elapsed_ms = ms(started);
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
        let elapsed_ms = ms(started);
        assert_eq!(note_service::list_notes(fixture.path()).unwrap().len(), 1_000);
        eprintln!("AINote baseline: batch_import_1000={elapsed_ms:.1}ms");
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_asset_import_20mb() {
        let fixture = tempfile::tempdir().unwrap();
        let source = fixture.path().join("large.bin");
        std::fs::write(&source, vec![0u8; 20 * 1024 * 1024]).unwrap();

        let started = Instant::now();
        let info = asset_service::import_asset(fixture.path(), source.to_str().unwrap()).unwrap();
        let elapsed_ms = ms(started);

        assert!(fixture.path().join(&info.path).is_file());
        eprintln!("AINote baseline: asset_import_20mb={elapsed_ms:.1}ms");
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_tree_1000_notes() {
        let fixture = tempfile::tempdir().unwrap();
        write_fixture(fixture.path(), 1_000);

        let started = Instant::now();
        let tree = note_service::list_tree(fixture.path()).unwrap();
        let elapsed_ms = ms(started);

        let notes_folder = tree.children.iter().find(|node| node.name == "notes").unwrap();
        assert_eq!(notes_folder.children.len(), 1_000);
        eprintln!("AINote baseline: tree_1000_notes={elapsed_ms:.1}ms");
    }

    #[test]
    #[ignore = "manual performance baseline"]
    fn perf_baseline_sync_status_300_commits() {
        let fixture = tempfile::tempdir().unwrap();
        init_repo_with_commits(fixture.path(), 300);

        let started = Instant::now();
        let status = sync_service::status(&Git2Backend, fixture.path()).unwrap();
        let elapsed_ms = ms(started);

        assert!(!status.has_uncommitted);
        assert!(!status.conflicted);
        eprintln!("AINote baseline: sync_status_300_commits={elapsed_ms:.1}ms");
    }
}
