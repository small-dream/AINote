//! 故障恢复演练：把「数据安全」关键场景固化为可重复运行的自动化测试。
//!
//! 覆盖场景：保存失败、误删（回收站）、仓库损坏 + 从备份恢复。
//! 对应文档见 `docs/INCIDENT_RECOVERY.md`。

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::sync::atomic::AtomicBool;

    use tempfile::tempdir;

    use crate::domain::maintenance::IssueSeverity;
    use crate::repositories::git2_backend::Git2Backend;
    use crate::repositories::git2_maintenance::Git2Maintenance;
    use crate::repositories::git_backend::GitBackend;
    use crate::repositories::repo_maintenance::RepoMaintenanceBackend;
    use crate::services::backup_service::{self, BackupOptions};
    use crate::services::{note_service, restore_service, trash_service};

    fn init_repo(path: &Path) {
        let repo = git2::Repository::init(path).unwrap();
        let mut config = repo.config().unwrap();
        config.set_str("user.name", "AINote").unwrap();
        config.set_str("user.email", "ainote@localhost").unwrap();
    }

    fn commit_all(path: &Path, message: &str) {
        Git2Backend
            .commit_all(path.to_str().unwrap(), message)
            .unwrap();
    }

    fn set_writable(path: &Path, writable: bool) {
        let mut permissions = fs::metadata(path).unwrap().permissions();
        permissions.set_readonly(!writable);
        fs::set_permissions(path, permissions).unwrap();
    }

    /// 场景：保存失败（文件只读）后原内容不丢，恢复权限后可重试成功。
    #[test]
    fn drill_save_failure_keeps_original_content() {
        let repo = tempdir().unwrap();
        init_repo(repo.path());
        note_service::update_note(repo.path(), "note.md", "v1").unwrap();

        let file = repo.path().join("note.md");
        set_writable(&file, false);
        assert!(note_service::update_note(repo.path(), "note.md", "v2").is_err());
        assert_eq!(note_service::read_note(repo.path(), "note.md").unwrap().content, "v1");

        set_writable(&file, true);
        note_service::update_note(repo.path(), "note.md", "v2").unwrap();
        assert_eq!(note_service::read_note(repo.path(), "note.md").unwrap().content, "v2");
    }

    /// 场景：误删笔记后可从回收站恢复，内容与路径保持不变。
    #[test]
    fn drill_deleted_note_restores_from_trash() {
        let repo = tempdir().unwrap();
        init_repo(repo.path());
        note_service::update_note(repo.path(), "notes/a.md", "precious").unwrap();
        note_service::delete_note(repo.path(), "notes/a.md").unwrap();
        assert!(!repo.path().join("notes/a.md").exists());

        let items = trash_service::list_trash(repo.path()).unwrap();
        let item = items.iter().find(|item| item.path == "notes/a.md").unwrap();
        trash_service::restore_trash_item(repo.path(), &item.id).unwrap();
        assert_eq!(
            note_service::read_note(repo.path(), "notes/a.md").unwrap().content,
            "precious"
        );
    }

    /// 场景：仓库对象损坏 → 完整性检查报错 → 从备份恢复后内容与健康状态恢复。
    #[test]
    fn drill_corrupted_repo_recovers_from_backup() {
        let repo = tempdir().unwrap();
        init_repo(repo.path());
        note_service::update_note(repo.path(), "notes/a.md", "precious").unwrap();
        commit_all(repo.path(), "init");

        let backup_dir = tempdir().unwrap();
        let zip = backup_dir.path().join("backup.zip");
        let cancel = AtomicBool::new(false);
        backup_service::export(
            repo.path(),
            &zip,
            &BackupOptions { exclude_assets: false },
            &cancel,
            |_| {},
        )
        .unwrap()
        .unwrap();

        corrupt_first_object(repo.path());
        let damaged = Git2Maintenance.check_integrity(repo.path()).unwrap();
        assert!(damaged.iter().any(|item| item.code == "REPO_3102"));

        let notes = tempdir().unwrap();
        let result = restore_service::restore(&zip, notes.path()).unwrap();
        let restored = Path::new(&result.repo_path);
        assert_eq!(fs::read_to_string(restored.join("notes/a.md")).unwrap(), "precious");

        let healthy = Git2Maintenance.check_integrity(restored).unwrap();
        assert!(!healthy.iter().any(|item| item.severity == IssueSeverity::Error));
    }

    fn corrupt_first_object(repo_path: &Path) {
        let objects = repo_path.join(".git/objects");
        for entry in fs::read_dir(&objects).unwrap().flatten() {
            if !entry.path().is_dir() {
                continue;
            }
            for inner in fs::read_dir(entry.path()).unwrap().flatten() {
                let path = inner.path();
                if path.is_file() {
                    set_writable(&path, true);
                    fs::write(&path, b"corrupted").unwrap();
                    return;
                }
            }
        }
        panic!("no loose object found to corrupt");
    }
}
