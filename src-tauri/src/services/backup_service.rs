//! 整库备份用例层：扫描仓库 → 流式写入 zip → 最后写入 manifest。
//!
//! 只读取仓库，不修改任何原始文件；导出失败或取消时删除半成品 zip。

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::domain::backup::{BackupExportDto, BackupManifest, BackupPhase, BackupProgressDto};
use crate::domain::error::AppError;
use crate::repositories::backup_files::{self, BackupFile, BackupWriter};

pub(crate) const SCHEMA_VERSION: u32 = 1;
const PROGRESS_STEP: usize = 25;

pub(crate) struct BackupOptions {
    pub(crate) exclude_assets: bool,
}

/// 生成备份包；用户取消时返回 `Ok(None)`。
pub(crate) fn export(
    root: &Path,
    dest: &Path,
    options: &BackupOptions,
    cancel: &AtomicBool,
    mut progress: impl FnMut(BackupProgressDto),
) -> Result<Option<BackupExportDto>, AppError> {
    progress(BackupProgressDto { phase: BackupPhase::Scanning, processed: 0, total: 0 });
    let files = backup_files::collect_files(root, options.exclude_assets, Some(dest))?;
    let outcome = write_backup(root, dest, options, cancel, &files, &mut progress);
    if outcome.is_err() || matches!(outcome, Ok(None)) {
        let _ = fs::remove_file(dest);
    }
    outcome
}

fn write_backup(
    root: &Path,
    dest: &Path,
    options: &BackupOptions,
    cancel: &AtomicBool,
    files: &[BackupFile],
    progress: &mut impl FnMut(BackupProgressDto),
) -> Result<Option<BackupExportDto>, AppError> {
    let total = files.len();
    let mut writer = BackupWriter::create(dest)?;
    for (index, file) in files.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Ok(None);
        }
        writer.append_file(file, &root.join(&file.relative))?;
        let processed = index + 1;
        if processed % PROGRESS_STEP == 0 || processed == total {
            progress(BackupProgressDto { phase: BackupPhase::Writing, processed, total });
        }
    }
    let (file_count, total_bytes) = writer.stats();
    let manifest = build_manifest(BuildManifestInput {
        repo_name: repo_name(root),
        file_count,
        total_bytes,
        sha256: writer.digest(),
        includes_assets: !options.exclude_assets,
    });
    let bytes = writer.finish(&manifest)?;
    Ok(Some(BackupExportDto {
        path: dest.to_string_lossy().into_owned(),
        bytes,
        file_count,
        total_bytes,
    }))
}

struct BuildManifestInput {
    repo_name: String,
    file_count: usize,
    total_bytes: u64,
    sha256: String,
    includes_assets: bool,
}

/// 组装 manifest（纯函数，时间与版本走参数，便于单测）。
fn build_manifest(input: BuildManifestInput) -> BackupManifest {
    BackupManifest {
        schema_version: SCHEMA_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        repo_name: input.repo_name,
        created_at: now_rfc3339(),
        file_count: input.file_count,
        total_bytes: input.total_bytes,
        sha256: input.sha256,
        includes_assets: input.includes_assets,
    }
}

fn now_rfc3339() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown".into())
}

fn repo_name(root: &Path) -> String {
    root.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "notes".into())
}

#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Read;

    use tempfile::tempdir;
    use zip::ZipArchive;

    use super::*;

    fn write(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    fn options() -> BackupOptions {
        BackupOptions { exclude_assets: false }
    }

    #[test]
    fn manifest_carries_counts_and_digest() {
        let manifest = build_manifest(BuildManifestInput {
            repo_name: "notes".into(),
            file_count: 2,
            total_bytes: 42,
            sha256: "abc".into(),
            includes_assets: true,
        });
        assert_eq!(manifest.schema_version, 1);
        assert_eq!(manifest.repo_name, "notes");
        assert_eq!(manifest.file_count, 2);
        assert_eq!(manifest.total_bytes, 42);
        assert_eq!(manifest.sha256, "abc");
        assert!(manifest.includes_assets);
        assert!(!manifest.created_at.is_empty());
    }

    #[test]
    fn exports_zip_with_repo_prefix_and_manifest() {
        let root = tempdir().unwrap();
        write(&root.path().join("notes/a.md"), "hello");
        write(&root.path().join(".git/HEAD"), "ref");
        let dest = root.path().join("backup.zip");

        let cancel = AtomicBool::new(false);
        let result = export(root.path(), &dest, &options(), &cancel, |_| {}).unwrap().unwrap();
        assert_eq!(result.file_count, 2);
        assert!(result.bytes > 0);

        let mut archive = ZipArchive::new(File::open(&dest).unwrap()).unwrap();
        assert!(archive.by_name("repo/notes/a.md").is_ok());
        assert!(archive.by_name("repo/.git/HEAD").is_ok());
        let mut manifest_text = String::new();
        archive.by_name("manifest.json").unwrap().read_to_string(&mut manifest_text).unwrap();
        let manifest: BackupManifest = serde_json::from_str(&manifest_text).unwrap();
        assert_eq!(manifest.file_count, 2);
        assert_eq!(manifest.total_bytes, 8);
        assert_eq!(manifest.sha256.len(), 64);
    }

    #[test]
    fn excludes_assets_when_requested() {
        let root = tempdir().unwrap();
        write(&root.path().join("a.md"), "a");
        write(&root.path().join("assets/big.bin"), "big");
        let dest = root.path().join("backup.zip");

        let cancel = AtomicBool::new(false);
        let result = export(
            root.path(),
            &dest,
            &BackupOptions { exclude_assets: true },
            &cancel,
            |_| {},
        )
        .unwrap()
        .unwrap();
        assert_eq!(result.file_count, 1);

        let mut archive = ZipArchive::new(File::open(&dest).unwrap()).unwrap();
        assert!(archive.by_name("repo/a.md").is_ok());
        assert!(archive.by_name("repo/assets/big.bin").is_err());
        let mut manifest_text = String::new();
        archive.by_name("manifest.json").unwrap().read_to_string(&mut manifest_text).unwrap();
        let manifest: BackupManifest = serde_json::from_str(&manifest_text).unwrap();
        assert!(!manifest.includes_assets);
    }

    #[test]
    fn cancel_leaves_no_partial_file() {
        let root = tempdir().unwrap();
        write(&root.path().join("a.md"), "a");
        write(&root.path().join("b.md"), "b");
        let dest = root.path().join("backup.zip");

        let cancel = AtomicBool::new(true);
        let result = export(root.path(), &dest, &options(), &cancel, |_| {}).unwrap();
        assert!(result.is_none());
        assert!(!dest.exists());
    }
}
