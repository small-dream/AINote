//! 备份包读取与安全解压：校验 manifest / 摘要、拒绝路径穿越与符号链接。

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;

use sha2::{Digest, Sha256};
use zip::read::ZipFile;
use zip::ZipArchive;

use crate::domain::backup::BackupManifest;
use crate::domain::error::AppError;

use super::backup_files::{MANIFEST_NAME, REPO_PREFIX};

/// 单个条目解压上限（512 MiB），防止压缩炸弹。
const MAX_ENTRY_BYTES: u64 = 512 * 1024 * 1024;
/// 整体解压上限（16 GiB）。
const MAX_TOTAL_BYTES: u64 = 16 * 1024 * 1024 * 1024;
const CHUNK_BYTES: usize = 64 * 1024;
const ZIP_MODE_SYMLINK: u32 = 0o120000;
const ZIP_MODE_MASK: u32 = 0o170000;

/// 读取并校验 manifest；格式版本不认识时直接拒绝。
pub(crate) fn read_manifest(path: &Path) -> Result<BackupManifest, AppError> {
    let mut archive = open(path)?;
    let mut text = String::new();
    archive
        .by_name(MANIFEST_NAME)
        .map_err(|_| AppError::Repo("备份包缺少 manifest.json".into()))?
        .read_to_string(&mut text)?;
    let manifest: BackupManifest = serde_json::from_str(&text)
        .map_err(|err| AppError::Repo(format!("manifest.json 解析失败：{err}")))?;
    if manifest.schema_version != 1 {
        return Err(AppError::Repo(format!(
            "不支持的备份格式版本：{}",
            manifest.schema_version
        )));
    }
    Ok(manifest)
}

/// 按导出顺序重算 `repo/` 内容摘要并与 manifest 比对。
pub(crate) fn verify_digest(path: &Path, expected: &str) -> Result<(), AppError> {
    let mut archive = open(path)?;
    let mut entries: Vec<(String, usize)> = Vec::new();
    for index in 0..archive.len() {
        let entry = by_index(&mut archive, index)?;
        if let Some(relative) = repo_relative(&entry)? {
            entries.push((relative, index));
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    let mut hasher = Sha256::new();
    for (relative, index) in entries {
        let mut entry = by_index(&mut archive, index)?;
        hasher.update(relative.as_bytes());
        hasher.update(entry.size().to_le_bytes());
        pump(&mut entry, &mut HashWriter(&mut hasher), MAX_TOTAL_BYTES)?;
    }
    let actual = hex(&hasher.finalize());
    if actual != expected {
        return Err(AppError::Repo(
            "备份包校验失败：内容与 manifest 中的 sha256 不一致".into(),
        ));
    }
    Ok(())
}

/// 把 `repo/` 前缀下的内容解压到 `dest`（去掉前缀），返回文件数。
pub(crate) fn extract_repo(path: &Path, dest: &Path) -> Result<usize, AppError> {
    let mut archive = open(path)?;
    let mut total = 0u64;
    let mut file_count = 0;
    for index in 0..archive.len() {
        let mut entry = by_index(&mut archive, index)?;
        let Some(relative) = repo_relative(&entry)? else {
            continue;
        };
        if entry.is_dir() {
            continue;
        }
        if entry.size() > MAX_ENTRY_BYTES {
            return Err(AppError::Repo(format!("备份条目过大，已拒绝：{relative}")));
        }
        total = total.saturating_add(entry.size());
        if total > MAX_TOTAL_BYTES {
            return Err(AppError::Repo("备份内容超过可恢复的大小上限".into()));
        }
        let target = dest.join(&relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut file = File::create(&target)?;
        let written = pump(&mut entry, &mut file, MAX_ENTRY_BYTES)?;
        if written != entry.size() {
            return Err(AppError::Repo(format!("备份条目内容长度不符：{relative}")));
        }
        file_count += 1;
    }
    Ok(file_count)
}

fn open(path: &Path) -> Result<ZipArchive<File>, AppError> {
    ZipArchive::new(File::open(path)?).map_err(|err| AppError::Repo(format!("无法读取备份包：{err}")))
}

fn by_index(archive: &mut ZipArchive<File>, index: usize) -> Result<ZipFile<'_, File>, AppError> {
    archive
        .by_index(index)
        .map_err(|err| AppError::Repo(format!("备份包条目损坏：{err}")))
}

/// 返回条目在仓库内的相对路径；非 `repo/` 条目返回 `None`。
/// 路径穿越、绝对路径、盘符、符号链接一律拒绝。
fn repo_relative(entry: &ZipFile<'_, File>) -> Result<Option<String>, AppError> {
    if is_symlink_mode(entry.unix_mode()) {
        return Err(AppError::Repo(format!(
            "备份包包含符号链接，已拒绝：{}",
            entry.name()
        )));
    }
    let name = entry.name();
    let Some(rest) = name.strip_prefix(REPO_PREFIX) else {
        return Ok(None);
    };
    if rest.is_empty() || rest.ends_with('/') {
        return Ok(None);
    }
    Ok(Some(safe_relative(rest)?))
}

/// 判断 zip 条目的 Unix 权限位是否为符号链接。
fn is_symlink_mode(mode: Option<u32>) -> bool {
    mode.is_some_and(|mode| mode & ZIP_MODE_MASK == ZIP_MODE_SYMLINK)
}

fn safe_relative(name: &str) -> Result<String, AppError> {
    if name.starts_with('/') || name.contains('\\') || name.contains(':') {
        return Err(AppError::Repo(format!("备份包含非法路径，已拒绝：{name}")));
    }
    let mut parts = Vec::new();
    for part in name.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err(AppError::Repo(format!("备份包含路径穿越，已拒绝：{name}")));
        }
        parts.push(part);
    }
    if parts.is_empty() {
        return Err(AppError::Repo(format!("备份包含空路径，已拒绝：{name}")));
    }
    Ok(parts.join("/"))
}

/// 边读边写，最多写出 `limit` 字节；超出即报错。
fn pump<R: Read, W: Write>(reader: &mut R, writer: &mut W, limit: u64) -> Result<u64, AppError> {
    let mut buffer = vec![0u8; CHUNK_BYTES];
    let mut written = 0u64;
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        written = written.saturating_add(read as u64);
        if written > limit {
            return Err(AppError::Repo("备份条目超过解压大小上限".into()));
        }
        writer.write_all(&buffer[..read])?;
    }
    Ok(written)
}

fn hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}

/// 把哈希器包装成 `Write`，让校验与解压共用同一套分块拷贝逻辑。
struct HashWriter<'a>(&'a mut Sha256);

impl std::io::Write for HashWriter<'_> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.update(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::io::Write as _;

    use tempfile::tempdir;
    use zip::write::SimpleFileOptions;
    use zip::ZipWriter;

    use super::*;

    fn write_zip(path: &Path, entries: &[(&str, &[u8], Option<u32>)]) {
        let mut writer = ZipWriter::new(File::create(path).unwrap());
        for (name, content, mode) in entries {
            let mut options = SimpleFileOptions::default();
            if let Some(mode) = mode {
                options = options.unix_permissions(*mode);
            }
            writer.start_file(*name, options).unwrap();
            writer.write_all(content).unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn rejects_parent_directory_traversal() {
        let tmp = tempdir().unwrap();
        let zip = tmp.path().join("evil.zip");
        write_zip(&zip, &[("repo/../escape.md", b"x", None)]);
        assert!(matches!(extract_repo(&zip, tmp.path()), Err(AppError::Repo(_))));
    }

    #[test]
    fn detects_symlink_modes() {
        assert!(is_symlink_mode(Some(0o120777)));
        assert!(is_symlink_mode(Some(0o120000)));
        assert!(!is_symlink_mode(Some(0o100644)));
        assert!(!is_symlink_mode(Some(0o040755)));
        assert!(!is_symlink_mode(None));
    }

    #[test]
    fn rejects_digest_mismatch() {
        let tmp = tempdir().unwrap();
        let zip = tmp.path().join("tampered.zip");
        let manifest = format!(
            r#"{{"schemaVersion":1,"appVersion":"0","repoName":"notes","createdAt":"now","fileCount":1,"totalBytes":3,"sha256":"{}","includesAssets":true}}"#,
            "0".repeat(64)
        );
        write_zip(&zip, &[("repo/a.md", b"abc", None), ("manifest.json", manifest.as_bytes(), None)]);
        assert!(matches!(verify_digest(&zip, &"0".repeat(64)), Err(AppError::Repo(_))));
    }

    #[test]
    fn rejects_missing_manifest() {
        let tmp = tempdir().unwrap();
        let zip = tmp.path().join("plain.zip");
        write_zip(&zip, &[("repo/a.md", b"a", None)]);
        assert!(matches!(read_manifest(&zip), Err(AppError::Repo(_))));
    }
}
