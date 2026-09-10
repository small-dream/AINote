//! 诊断包文件写入：只负责把内存中的条目写成 zip，不做内容决策。

use std::fs::File;
use std::io::Write;
use std::path::Path;

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use crate::domain::error::AppError;

/// 待写入 zip 的单个文件（路径使用 `/` 分隔，不允许 `..`）。
pub(crate) struct ZipEntry {
    pub(crate) name: String,
    pub(crate) content: Vec<u8>,
}

/// 把条目写入 `dest`，返回压缩包字节数。写入失败时保留已写出的部分文件。
pub(crate) fn write_zip(dest: &Path, entries: &[ZipEntry]) -> Result<u64, AppError> {
    let file = File::create(dest)?;
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for entry in entries {
        if entry.name.contains("..") {
            return Err(AppError::InvalidPath(entry.name.clone()));
        }
        writer
            .start_file(&entry.name, options)
            .map_err(|err| AppError::Io(err.to_string()))?;
        writer.write_all(&entry.content)?;
    }
    writer.finish().map_err(|err| AppError::Io(err.to_string()))?;
    Ok(std::fs::metadata(dest)?.len())
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use tempfile::tempdir;
    use zip::ZipArchive;

    use super::*;

    #[test]
    fn writes_expected_entries() {
        let tmp = tempdir().unwrap();
        let dest = tmp.path().join("diag.zip");
        let entries = vec![
            ZipEntry { name: "manifest.json".into(), content: b"{}".to_vec() },
            ZipEntry { name: "logs/ainote.log".into(), content: b"hello".to_vec() },
        ];
        let bytes = write_zip(&dest, &entries).unwrap();
        assert!(bytes > 0);

        let mut archive = ZipArchive::new(File::open(&dest).unwrap()).unwrap();
        assert_eq!(archive.len(), 2);
        let mut log = String::new();
        archive
            .by_name("logs/ainote.log")
            .unwrap()
            .read_to_string(&mut log)
            .unwrap();
        assert_eq!(log, "hello");
    }

    #[test]
    fn rejects_parent_directory_entries() {
        let tmp = tempdir().unwrap();
        let dest = tmp.path().join("diag.zip");
        let entries = vec![ZipEntry { name: "../escape".into(), content: Vec::new() }];
        assert!(matches!(
            write_zip(&dest, &entries),
            Err(AppError::InvalidPath(_))
        ));
    }
}
