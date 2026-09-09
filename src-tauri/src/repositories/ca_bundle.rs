//! Android HTTPS 信任锚配置。
//!
//! 背景：openssl-src 在 Android 上固定给 OpenSSL `Configure` 传 `no-stdio`，
//! 使 `BIO_new_file` 变成空实现，libgit2 无法读取任何文件型信任库；同时 Android
//! 系统 CA 目录使用 OpenSSL 1.0 的旧式 subject hash，与 1.1+ 的目录查找不兼容。
//! 这里把所有系统 CA 合并成单个 PEM bundle 交给 libgit2，绕过目录查找并恢复完整
//! 证书链校验（不再对 github.com 直接放行）。
//!
//! 构建侧要求见 `build.rs` 与 `scripts/openssl-src-perl-wrapper.sh`。

use crate::domain::error::AppError;
#[cfg(any(test, target_os = "android"))]
use std::path::PathBuf;
#[cfg(target_os = "android")]
use std::path::Path;
#[cfg(target_os = "android")]
use std::sync::OnceLock;

#[cfg(target_os = "android")]
static BUNDLE_DIR: OnceLock<PathBuf> = OnceLock::new();

/// 设置 CA bundle 输出目录（Android 应用 cache 目录），必须在首次网络操作前调用。
#[cfg(target_os = "android")]
pub fn set_bundle_dir(dir: PathBuf) {
    let _ = BUNDLE_DIR.set(dir);
}

/// 首次网络操作前配置 libgit2 的 CA 位置；非 Android 平台为空实现。
pub(crate) fn configure_ssl_certificates() -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        static CONFIGURED: OnceLock<Result<(), String>> = OnceLock::new();
        return CONFIGURED
            .get_or_init(configure_android)
            .clone()
            .map_err(AppError::Git);
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(())
    }
}

#[cfg(target_os = "android")]
fn configure_android() -> Result<(), String> {
    let path = bundle_path()?;
    let pem = build_android_bundle()?;
    write_atomic(&path, pem.as_bytes())?;
    // SAFETY: 在首个网络操作前设置 libgit2 全局选项，OnceLock 保证仅执行一次。
    unsafe { git2::opts::set_ssl_cert_file(path) }.map_err(|error| error.message().to_string())
}

#[cfg(target_os = "android")]
fn bundle_path() -> Result<PathBuf, String> {
    let dir = BUNDLE_DIR
        .get()
        .cloned()
        .ok_or_else(|| "Android CA bundle 目录未初始化".to_string())?;
    std::fs::create_dir_all(&dir).map_err(|error| format!("创建 CA bundle 目录失败: {error}"))?;
    Ok(dir.join("ainote-ca-bundle.pem"))
}

#[cfg(target_os = "android")]
fn build_android_bundle() -> Result<String, String> {
    let dirs: Vec<PathBuf> =
        ["/apex/com.android.conscrypt/cacerts", "/system/etc/security/cacerts"]
            .into_iter()
            .map(PathBuf::from)
            .filter(|path| path.is_dir())
            .collect();
    if dirs.is_empty() {
        return Err("未找到 Android 系统 CA 证书目录".into());
    }
    build_ca_bundle(&dirs, include_str!("sectigo_e46.pem"))
}

/// 读取若干目录下的证书文件并合并为去重后的单个 PEM bundle。
#[cfg(any(test, target_os = "android"))]
fn build_ca_bundle(dirs: &[PathBuf], extra_pem: &str) -> Result<String, String> {
    let mut seen = std::collections::HashSet::new();
    let mut blocks = Vec::new();
    for dir in dirs {
        // 单个目录不可读时跳过，由最终“没有任何证书”统一失败，避免厂商裁剪导致整体不可用。
        let Ok(entries) = std::fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let Ok(raw) = std::fs::read(&path) else {
                continue;
            };
            for block in extract_pem_blocks(&String::from_utf8_lossy(&raw)) {
                if seen.insert(block.clone()) {
                    blocks.push(block);
                }
            }
        }
    }
    for block in extract_pem_blocks(extra_pem) {
        if seen.insert(block.clone()) {
            blocks.push(block);
        }
    }
    if blocks.is_empty() {
        return Err("Android 系统 CA 目录未找到可用证书".into());
    }
    Ok(blocks.join("\n") + "\n")
}

/// 提取文本中所有完整的 `BEGIN/END CERTIFICATE` 块，忽略块外内容。
#[cfg(any(test, target_os = "android"))]
fn extract_pem_blocks(input: &str) -> Vec<String> {
    const BEGIN: &str = "-----BEGIN CERTIFICATE-----";
    const END: &str = "-----END CERTIFICATE-----";
    let mut blocks = Vec::new();
    let mut rest = input;
    while let Some(start) = rest.find(BEGIN) {
        let candidate = &rest[start..];
        let Some(end) = candidate.find(END) else {
            break;
        };
        blocks.push(candidate[..end + END.len()].trim().to_string());
        rest = &candidate[end + END.len()..];
    }
    blocks
}

#[cfg(target_os = "android")]
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes).map_err(|error| format!("写入 CA bundle 失败: {error}"))?;
    std::fs::rename(&tmp, path).map_err(|error| format!("替换 CA bundle 失败: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{build_ca_bundle, extract_pem_blocks};
    use std::path::PathBuf;

    const CERT_A: &str = "-----BEGIN CERTIFICATE-----\nQUFB\n-----END CERTIFICATE-----";
    const CERT_B: &str = "-----BEGIN CERTIFICATE-----\nQkJC\n-----END CERTIFICATE-----";

    #[test]
    fn extract_keeps_blocks_and_ignores_noise() {
        let input = format!("noise\n{CERT_A}\ntrailing");
        assert_eq!(extract_pem_blocks(&input), vec![CERT_A.to_string()]);
    }

    #[test]
    fn extract_stops_at_unterminated_block() {
        assert!(extract_pem_blocks("-----BEGIN CERTIFICATE-----\nQUFB").is_empty());
    }

    #[test]
    fn build_merges_dirs_and_dedups_extra() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.0"), CERT_A).unwrap();
        std::fs::write(dir.path().join("b.0"), format!("{CERT_B}\n{CERT_A}")).unwrap();
        let bundle = build_ca_bundle(&[PathBuf::from(dir.path())], CERT_A).unwrap();
        assert_eq!(bundle.matches("-----BEGIN CERTIFICATE-----").count(), 2);
        assert!(bundle.contains("QkJC"));
    }

    #[test]
    fn build_errors_without_certificates() {
        let dir = tempfile::tempdir().unwrap();
        let error = build_ca_bundle(&[PathBuf::from(dir.path())], "").unwrap_err();
        assert!(error.contains("未找到可用证书"));
    }
}
