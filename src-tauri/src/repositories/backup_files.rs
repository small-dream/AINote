//! 备份包文件 IO：递归扫描仓库、流式写入 zip，并同步计算内容摘要。
//!
//! 包内结构：`repo/<仓库相对路径>`（含 `.git/`）+ 根目录 `manifest.json`（最后写入）。
//! 前缀 `repo/` 既可避免与仓库内同名文件冲突，也让恢复端有明确的解压白名单。

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::domain::backup::BackupManifest;
use crate::domain::error::AppError;

/// zip 内仓库内容的固定前缀。
pub(crate) const REPO_PREFIX: &str = "repo/";
/// 备份包内的 manifest 条目名。
pub(crate) const MANIFEST_NAME: &str = "manifest.json";

const CHUNK_BYTES: usize = 64 * 1024;

/// 扫描到的单个文件。
pub(crate) struct BackupFile {
    /// 仓库相对路径，统一使用 `/` 分隔。
    pub(crate) relative: String,
    pub(crate) size: u64,
}

/// 递归收集待备份文件：跳过符号链接、目标 zip 自身；可选跳过顶层 `assets/`。
pub(crate) fn collect_files(
    root: &Path,
    exclude_assets: bool,
    skip: Option<&Path>,
) -> Result<Vec<BackupFile>, AppError> {
    let root = fs::canonicalize(root)?;
    let skip = skip.and_then(|path| fs::canonicalize(path).ok());
    let mut files = Vec::new();
    walk(&root, &root, exclude_assets, skip.as_deref(), &mut files)?;
    files.sort_by(|a, b| a.relative.cmp(&b.relative));
    Ok(files)
}

fn walk(
    root: &Path,
    dir: &Path,
    exclude_assets: bool,
    skip: Option<&Path>,
    files: &mut Vec<BackupFile>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        if skip.is_some_and(|skip_path| path == skip_path) {
            continue;
        }
        if exclude_assets && is_top_level_assets(root, &path) {
            continue;
        }
        if file_type.is_dir() {
            walk(root, &path, exclude_assets, skip, files)?;
        } else if file_type.is_file() {
            let relative = relative_path(root, &path)?;
            let size = entry.metadata()?.len();
            files.push(BackupFile { relative, size });
        }
    }
    Ok(())
}

/// 仅跳过仓库顶层的 `assets/` 目录。
fn is_top_level_assets(root: &Path, path: &Path) -> bool {
    path.parent() == Some(root) && path.file_name().is_some_and(|name| name == "assets")
}

/// 统一转成 `/` 分隔的相对路径。
fn relative_path(root: &Path, path: &Path) -> Result<String, AppError> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| AppError::InvalidPath(path.display().to_string()))?;
    let mut name = String::new();
    for component in relative.components() {
        if !name.is_empty() {
            name.push('/');
        }
        name.push_str(&component.as_os_str().to_string_lossy());
    }
    Ok(name)
}

/// 流式备份写入器：边写边算摘要，`finish` 时把 manifest 作为最后一个条目写入。
pub(crate) struct BackupWriter {
    writer: ZipWriter<File>,
    dest: PathBuf,
    hasher: Sha256,
    total_bytes: u64,
    file_count: usize,
}

impl BackupWriter {
    pub(crate) fn create(dest: &Path) -> Result<Self, AppError> {
        let writer = ZipWriter::new(File::create(dest)?);
        Ok(Self {
            writer,
            dest: dest.to_path_buf(),
            hasher: Sha256::new(),
            total_bytes: 0,
            file_count: 0,
        })
    }

    /// 写入一个文件：名字与长度进入摘要，内容以 64KB 分块同时写盘与摘要。
    pub(crate) fn append_file(&mut self, file: &BackupFile, source: &Path) -> Result<(), AppError> {
        self.hasher.update(file.relative.as_bytes());
        self.hasher.update(file.size.to_le_bytes());
        self.writer
            .start_file(format!("{REPO_PREFIX}{}", file.relative), Self::options())
            .map_err(|err| AppError::Io(err.to_string()))?;
        let mut source_file = File::open(source)?;
        let mut buffer = vec![0u8; CHUNK_BYTES];
        let mut written = 0u64;
        loop {
            let read = source_file.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            self.hasher.update(&buffer[..read]);
            self.writer.write_all(&buffer[..read])?;
            written += read as u64;
        }
        self.total_bytes += written;
        self.file_count += 1;
        Ok(())
    }

    /// 写入 manifest 并收尾，返回 zip 文件字节数。
    pub(crate) fn finish(mut self, manifest: &BackupManifest) -> Result<u64, AppError> {
        self.writer
            .start_file(MANIFEST_NAME, Self::options())
            .map_err(|err| AppError::Io(err.to_string()))?;
        let json = serde_json::to_vec_pretty(manifest).map_err(|err| AppError::Io(err.to_string()))?;
        self.writer.write_all(&json)?;
        self.writer.finish().map_err(|err| AppError::Io(err.to_string()))?;
        Ok(fs::metadata(&self.dest)?.len())
    }

    pub(crate) fn digest(&self) -> String {
        hex(&self.hasher.clone().finalize())
    }

    pub(crate) fn stats(&self) -> (usize, u64) {
        (self.file_count, self.total_bytes)
    }

    fn options() -> SimpleFileOptions {
        SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)
    }
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn write(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content).unwrap();
    }

    #[test]
    fn collects_files_sorted_and_skips_assets() {
        let root = tempdir().unwrap();
        write(&root.path().join("b.md"), "b");
        write(&root.path().join("notes/a.md"), "a");
        write(&root.path().join("assets/big.bin"), "big");
        write(&root.path().join(".git/HEAD"), "ref");

        let files = collect_files(root.path(), true, None).unwrap();
        let names: Vec<_> = files.iter().map(|f| f.relative.clone()).collect();
        assert_eq!(names, vec![".git/HEAD".to_string(), "b.md".to_string(), "notes/a.md".to_string()]);
    }

    #[test]
    fn keeps_assets_by_default() {
        let root = tempdir().unwrap();
        write(&root.path().join("assets/big.bin"), "big");
        let files = collect_files(root.path(), false, None).unwrap();
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].relative, "assets/big.bin");
    }

    #[test]
    fn digest_is_deterministic_and_content_sensitive() {
        let root = tempdir().unwrap();
        write(&root.path().join("a.md"), "hello");
        let files = collect_files(root.path(), false, None).unwrap();

        let dest_a = root.path().join("a.zip");
        let mut writer = BackupWriter::create(&dest_a).unwrap();
        writer.append_file(&files[0], &root.path().join("a.md")).unwrap();
        let first = writer.digest();

        let dest_b = root.path().join("b.zip");
        let mut writer = BackupWriter::create(&dest_b).unwrap();
        writer.append_file(&files[0], &root.path().join("a.md")).unwrap();
        assert_eq!(first, writer.digest());

        write(&root.path().join("a.md"), "world");
        let mut writer = BackupWriter::create(&root.path().join("c.zip")).unwrap();
        writer.append_file(&files[0], &root.path().join("a.md")).unwrap();
        assert_ne!(first, writer.digest());
    }
}
