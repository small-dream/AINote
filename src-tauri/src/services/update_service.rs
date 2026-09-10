//! 移动端更新包下载与校验（ureq 阻塞式；由 Command 在后台线程中调用）。
//! 下载地址白名单限定官方 GitHub Release，落盘后必须过 SHA-256 校验。

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use sha2::{Digest, Sha256};

use crate::domain::error::AppError;
use crate::domain::update::UpdateDownloadProgressDto;

/// 更新包与校验和仅允许来自官方仓库的 Release 下载地址（防 webview 注入任意 URL）。
const ALLOWED_PREFIX: &str = "https://github.com/small-dream/AINote/releases/download/";
const CHUNK_SIZE: usize = 64 * 1024;
const DOWNLOAD_TIMEOUT_SECS: u64 = 600;

pub fn apk_download_url_allowed(url: &str) -> bool {
    url.starts_with(ALLOWED_PREFIX) && url.ends_with(".apk")
}

pub fn sha256_url_allowed(url: &str) -> bool {
    url.starts_with(ALLOWED_PREFIX) && url.ends_with(".apk.sha256")
}

/// 安装路径防穿越：仅允许 updates 目录内由本应用下载的 APK 文件。
pub fn install_path_allowed(dir: &Path, path: &Path) -> bool {
    path.parent() == Some(dir)
        && path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("ainote-") && name.ends_with(".apk"))
}

/// 解析 sha256 校验文件：取首个空白分隔的 64 位十六进制串（小写）。
pub fn parse_sha256_file(content: &str) -> Option<String> {
    let token = content.split_whitespace().next()?;
    let valid = token.len() == 64 && token.bytes().all(|b| b.is_ascii_hexdigit());
    valid.then(|| token.to_ascii_lowercase())
}

/// 流式计算文件 SHA-256（十六进制小写）。
pub fn sha256_hex(path: &Path) -> Result<String, AppError> {
    let mut file = fs::File::open(path)
        .map_err(|err| AppError::io_context("读取更新包失败", path, err))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; CHUNK_SIZE];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|err| AppError::io_context("读取更新包失败", path, err))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(to_hex(&hasher.finalize()))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn agent() -> ureq::Agent {
    let config = ureq::Agent::config_builder()
        .timeout_global(Some(std::time::Duration::from_secs(DOWNLOAD_TIMEOUT_SECS)))
        .build();
    ureq::Agent::new_with_config(config)
}

/// 下载 APK 并校验 SHA-256，返回最终文件路径；`cancel` 置位时返回 `Ok(None)`。
/// 任何失败都会清理临时文件，成功前不覆盖旧文件。
pub fn download_apk(
    url: &str,
    sha256_url: &str,
    version: &str,
    dir: &Path,
    cancel: &AtomicBool,
    on_progress: impl Fn(UpdateDownloadProgressDto),
) -> Result<Option<PathBuf>, AppError> {
    if !apk_download_url_allowed(url) || !sha256_url_allowed(sha256_url) {
        return Err(AppError::UpdateDownload("更新包地址不在允许范围".into()));
    }
    fs::create_dir_all(dir).map_err(|err| AppError::io_context("创建更新目录失败", dir, err))?;
    clear_stale_files(dir);

    let file_name = format!("ainote-{version}.apk");
    let part_path = dir.join(format!("{file_name}.part"));
    let result = download_to_file(url, &part_path, cancel, &on_progress);
    if result.is_err() || cancel.load(Ordering::SeqCst) {
        let _ = fs::remove_file(&part_path);
    }
    // false = 用户取消
    if !result? {
        return Ok(None);
    }

    let expected = fetch_expected_sha256(sha256_url)?;
    let actual = sha256_hex(&part_path)?;
    if actual != expected {
        let _ = fs::remove_file(&part_path);
        return Err(AppError::UpdateChecksum(format!(
            "期望 {expected}，实际 {actual}"
        )));
    }

    let final_path = dir.join(&file_name);
    fs::rename(&part_path, &final_path)
        .map_err(|err| AppError::io_context("保存更新包失败", &final_path, err))?;
    Ok(Some(final_path))
}

/// 下载前的目录清理：删除历史 APK 与残留临时文件，避免积累占用。
fn clear_stale_files(dir: &Path) {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.ends_with(".apk") || name.ends_with(".apk.part") {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/// 分块下载到临时文件；返回 `Ok(false)` 表示用户取消。进度按百分比变化节流上报。
fn download_to_file(
    url: &str,
    part_path: &Path,
    cancel: &AtomicBool,
    on_progress: &impl Fn(UpdateDownloadProgressDto),
) -> Result<bool, AppError> {
    let response = agent()
        .get(url)
        .header("User-Agent", "AINote")
        .call()
        .map_err(|err| AppError::UpdateDownload(err.to_string()))?;
    let total_bytes = response
        .headers()
        .get("content-length")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    let mut reader = response.into_body().into_reader();
    let mut file = fs::File::create(part_path)
        .map_err(|err| AppError::io_context("创建更新包文件失败", part_path, err))?;
    let mut received_bytes = 0u64;
    let mut last_percent: Option<u32> = None;
    let mut buffer = [0u8; CHUNK_SIZE];

    loop {
        if cancel.load(Ordering::SeqCst) {
            return Ok(false);
        }
        let read = reader
            .read(&mut buffer)
            .map_err(|err| AppError::UpdateDownload(err.to_string()))?;
        if read == 0 {
            break;
        }
        file.write_all(&buffer[..read])
            .map_err(|err| AppError::io_context("写入更新包失败", part_path, err))?;
        received_bytes += read as u64;
        let percent = total_bytes
            .filter(|total| *total > 0)
            .map(|total| ((received_bytes * 100) / total).min(100) as u32);
        if percent != last_percent {
            last_percent = percent;
            on_progress(UpdateDownloadProgressDto {
                received_bytes,
                total_bytes,
                percent,
            });
        }
    }
    file.flush()
        .map_err(|err| AppError::io_context("写入更新包失败", part_path, err))?;
    Ok(true)
}

/// 拉取并解析校验和文件（体积小，直接读入内存）。
fn fetch_expected_sha256(sha256_url: &str) -> Result<String, AppError> {
    let mut response = agent()
        .get(sha256_url)
        .header("User-Agent", "AINote")
        .call()
        .map_err(|err| AppError::UpdateDownload(format!("获取校验和失败: {err}")))?;
    let content = response
        .body_mut()
        .read_to_string()
        .map_err(|err| AppError::UpdateDownload(format!("读取校验和失败: {err}")))?;
    parse_sha256_file(&content)
        .ok_or_else(|| AppError::UpdateChecksum("校验和文件格式无效".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    const APK_URL: &str =
        "https://github.com/small-dream/AINote/releases/download/v0.26.2/AINote-v0.26.2-android-arm64.apk";

    #[test]
    fn allows_only_official_release_apk_urls() {
        assert!(apk_download_url_allowed(APK_URL));
        assert!(!apk_download_url_allowed(
            "https://evil.example.com/AINote-v0.26.2-android-arm64.apk"
        ));
        assert!(!apk_download_url_allowed(
            "https://github.com/small-dream/AINote/releases/download/v0.26.2/AINote.exe"
        ));
        assert!(!apk_download_url_allowed("http://github.com/small-dream/AINote/releases/download/v0.26.2/x.apk"));
    }

    #[test]
    fn allows_only_official_sha256_urls() {
        assert!(sha256_url_allowed(&format!("{APK_URL}.sha256")));
        assert!(!sha256_url_allowed(APK_URL));
        assert!(!sha256_url_allowed(
            "https://github.com/other/repo/releases/download/v1/x.apk.sha256"
        ));
    }

    #[test]
    fn parses_standard_sha256_file() {
        let hash = "a".repeat(64);
        assert_eq!(
            parse_sha256_file(&format!("{hash}  AINote-v0.26.2-android-arm64.apk\n")),
            Some(hash.clone())
        );
        assert_eq!(parse_sha256_file(&hash.to_uppercase()), Some(hash));
        assert_eq!(parse_sha256_file("not-a-hash  file.apk"), None);
        assert_eq!(parse_sha256_file(""), None);
    }

    #[test]
    fn sha256_hex_matches_known_digest() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("sample.bin");
        fs::write(&file, b"ainote").unwrap();
        assert_eq!(
            sha256_hex(&file).unwrap(),
            "be7c83a93906d566901d96ea2e20dc1cfe1bc18df2a8aef6a03d348e1e1021ce"
        );
    }

    #[test]
    fn install_path_requires_updates_dir_and_apk_name() {
        let dir = Path::new("/cache/updates");
        assert!(install_path_allowed(dir, &dir.join("ainote-0.27.0.apk")));
        assert!(!install_path_allowed(dir, &dir.join("evil.apk")));
        assert!(!install_path_allowed(dir, &dir.join("ainote-0.27.0.apk.part")));
        assert!(!install_path_allowed(dir, Path::new("/etc/ainote-0.27.0.apk")));
        assert!(!install_path_allowed(
            dir,
            &dir.join("sub").join("ainote-0.27.0.apk")
        ));
    }
}
