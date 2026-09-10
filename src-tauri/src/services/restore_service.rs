//! 从备份恢复用例层：校验 → 解压到临时目录 → 完整性检查 → 移入目标目录。
//!
//! 任何一步失败都会清理临时目录，绝不在目标位置留下半成品仓库。

use std::fs;
use std::path::{Path, PathBuf};

use crate::domain::backup::RestoreResultDto;
use crate::domain::error::AppError;
use crate::domain::maintenance::IssueSeverity;
use crate::repositories::git2_maintenance::Git2Maintenance;
use crate::repositories::repo_maintenance::RepoMaintenanceBackend;
use crate::repositories::restore_files;

/// 恢复备份到 `notes_dir/<仓库名>`，返回目标路径与文件数。
pub(crate) fn restore(archive_path: &Path, notes_dir: &Path) -> Result<RestoreResultDto, AppError> {
    let manifest = restore_files::read_manifest(archive_path)?;
    restore_files::verify_digest(archive_path, &manifest.sha256)?;
    if manifest.file_count == 0 {
        return Err(AppError::Repo("备份包内没有可恢复的文件".into()));
    }

    let name = sanitize_name(&manifest.repo_name);
    let target = notes_dir.join(&name);
    if target.exists() {
        return Err(AppError::Repo(format!(
            "目标目录已存在：{}。请先移除同名仓库后重试。",
            target.display()
        )));
    }

    fs::create_dir_all(notes_dir)?;
    let temp = unique_temp_dir(notes_dir);
    fs::create_dir_all(&temp)?;
    match extract_and_check(archive_path, &temp) {
        Ok(file_count) => {
            fs::rename(&temp, &target)?;
            Ok(RestoreResultDto {
                repo_path: target.to_string_lossy().into_owned(),
                name,
                file_count,
            })
        }
        Err(err) => {
            let _ = fs::remove_dir_all(&temp);
            Err(err)
        }
    }
}

fn extract_and_check(archive_path: &Path, temp: &Path) -> Result<usize, AppError> {
    let file_count = restore_files::extract_repo(archive_path, temp)?;
    let issues = Git2Maintenance.check_integrity(temp)?;
    if let Some(problem) = issues.iter().find(|item| item.severity == IssueSeverity::Error) {
        return Err(AppError::Repo(format!(
            "备份内容未通过完整性检查（{}）：{}",
            problem.code, problem.message
        )));
    }
    Ok(file_count)
}

/// 仓库名安全化：只保留字母数字、`-`、`_`，避免逃出 notes 目录。
fn sanitize_name(seed: &str) -> String {
    let mut name: String = seed
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    name = name.trim_matches('-').trim_matches('_').to_string();
    if name.is_empty() || name == "." || name == ".." {
        return "restored-notes".into();
    }
    name
}

fn unique_temp_dir(notes_dir: &Path) -> PathBuf {
    let stamp = time::OffsetDateTime::now_utc().unix_timestamp_nanos();
    notes_dir.join(format!(".restore-{stamp}"))
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::AtomicBool;

    use tempfile::tempdir;

    use super::*;
    use crate::services::backup_service::{self, BackupOptions};

    fn init_git_repo(path: &Path) {
        let repo = git2::Repository::init(path).unwrap();
        {
            let mut config = repo.config().unwrap();
            config.set_str("user.name", "AINote").unwrap();
            config.set_str("user.email", "ainote@localhost").unwrap();
        }
        fs::write(path.join("note.md"), "hello").unwrap();
        let mut index = repo.index().unwrap();
        index.add_all(["*"], git2::IndexAddOption::DEFAULT, None).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = repo.signature().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[]).unwrap();
    }

    #[test]
    fn sanitizes_dangerous_names() {
        assert_eq!(sanitize_name("my notes"), "my-notes");
        assert_eq!(sanitize_name("../evil"), "evil");
        assert_eq!(sanitize_name(""), "restored-notes");
        assert_eq!(sanitize_name(".."), "restored-notes");
    }

    #[test]
    fn round_trip_restores_repo_with_history() {
        let repo_dir = tempdir().unwrap();
        init_git_repo(repo_dir.path());
        fs::create_dir_all(repo_dir.path().join("notes")).unwrap();
        fs::write(repo_dir.path().join("notes/a.md"), "content").unwrap();

        let zip_dir = tempdir().unwrap();
        let zip = zip_dir.path().join("backup.zip");
        let cancel = AtomicBool::new(false);
        backup_service::export(repo_dir.path(), &zip, &BackupOptions { exclude_assets: false }, &cancel, |_| {})
            .unwrap()
            .unwrap();

        let notes = tempdir().unwrap();
        let result = restore(&zip, notes.path()).unwrap();
        assert!(result.file_count >= 2);
        let restored = Path::new(&result.repo_path);
        assert!(restored.join("notes/a.md").is_file());
        assert!(git2::Repository::open(restored).is_ok());
    }

    #[test]
    fn refuses_existing_target() {
        let repo_dir = tempdir().unwrap();
        init_git_repo(repo_dir.path());
        let zip_dir = tempdir().unwrap();
        let zip = zip_dir.path().join("backup.zip");
        let cancel = AtomicBool::new(false);
        backup_service::export(repo_dir.path(), &zip, &BackupOptions { exclude_assets: false }, &cancel, |_| {})
            .unwrap()
            .unwrap();

        let notes = tempdir().unwrap();
        let name = repo_dir.path().file_name().unwrap().to_string_lossy().into_owned();
        fs::create_dir_all(notes.path().join(sanitize_name(&name))).unwrap();
        assert!(matches!(restore(&zip, notes.path()), Err(AppError::Repo(_))));
    }
}
