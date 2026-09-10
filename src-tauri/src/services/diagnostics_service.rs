//! 诊断包用例层：把版本 / 平台 / 配置摘要 / 同步状态 / 脱敏日志组装为 zip。
//!
//! 内容白名单：`manifest.json`、`summary.json`、`logs/ainote.log`。
//! 绝不包含笔记正文、Token、API Key、完整用户路径或带凭据的远端 URL。

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use crate::domain::diagnostics::{
    DiagnosticsConfigSummary, DiagnosticsErrorCount, DiagnosticsExportDto, DiagnosticsManifest,
    DiagnosticsSummary, DiagnosticsSyncSummary,
};
use crate::domain::error::AppError;
use crate::domain::sync::SyncStatus;
use crate::repositories::diagnostics_files::{self, ZipEntry};

pub(crate) const SCHEMA_VERSION: u32 = 1;
const LOG_FILE_NAME: &str = "ainote.log";
const MAX_LOG_BYTES: usize = 256 * 1024;
const ZIP_ENTRIES: [&str; 3] = ["manifest.json", "summary.json", "logs/ainote.log"];

pub(crate) struct DiagnosticsInput {
    pub(crate) config: DiagnosticsConfigSummary,
    pub(crate) sync: Option<SyncStatus>,
    pub(crate) repo_size_bytes: Option<u64>,
    pub(crate) log_text: String,
}

/// 读取日志目录中最近一段日志，并再次脱敏（日志写入时已脱敏，此处为兜底）。
pub(crate) fn read_recent_logs(log_dir: &Path) -> String {
    let Ok(bytes) = fs::read(log_dir.join(LOG_FILE_NAME)) else {
        return String::new();
    };
    let start = bytes.len().saturating_sub(MAX_LOG_BYTES);
    let text = String::from_utf8_lossy(&bytes[start..]);
    crate::config::logging::redact(&text)
}

/// 统计日志中的错误码出现次数，如 `SYNC_4002`。
pub(crate) fn count_error_codes(log_text: &str) -> Vec<DiagnosticsErrorCount> {
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    for token in log_text.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_')) {
        if is_error_code(token) {
            *counts.entry(token).or_insert(0) += 1;
        }
    }
    counts
        .into_iter()
        .map(|(code, count)| DiagnosticsErrorCount {
            code: code.to_string(),
            count,
        })
        .collect()
}

fn is_error_code(token: &str) -> bool {
    let Some((domain, digits)) = token.split_once('_') else {
        return false;
    };
    !domain.is_empty()
        && domain
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        && digits.len() == 4
        && digits.chars().all(|c| c.is_ascii_digit())
}

pub(crate) fn build_manifest(app_version: &str, generated_at: &str) -> DiagnosticsManifest {
    DiagnosticsManifest {
        schema_version: SCHEMA_VERSION,
        app_version: app_version.to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        generated_at: generated_at.to_string(),
        files: ZIP_ENTRIES.iter().map(|name| (*name).to_string()).collect(),
    }
}

pub(crate) fn build_summary(input: &DiagnosticsInput) -> DiagnosticsSummary {
    DiagnosticsSummary {
        repo_count: input.config.repo_count,
        has_active_repo: input.config.has_active_repo,
        has_token: input.config.has_token,
        sync: input.sync.as_ref().map_or_else(DiagnosticsSyncSummary::default, |status| {
            DiagnosticsSyncSummary {
                ahead: status.ahead,
                behind: status.behind,
                has_uncommitted: status.has_uncommitted,
                conflicted: status.conflicted,
            }
        }),
        repo_size_bytes: input.repo_size_bytes,
        error_counts: count_error_codes(&input.log_text),
        log_lines: input.log_text.lines().count(),
    }
}

/// 生成诊断包并返回保存路径与字节数。
pub(crate) fn export(
    dest: &Path,
    mut input: DiagnosticsInput,
) -> Result<DiagnosticsExportDto, AppError> {
    input.log_text = crate::config::logging::redact(&input.log_text);
    let generated_at = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "unknown".into());
    let manifest = build_manifest(env!("CARGO_PKG_VERSION"), &generated_at);
    let summary = build_summary(&input);
    let entries = vec![
        ZipEntry {
            name: "manifest.json".into(),
            content: to_json(&manifest)?,
        },
        ZipEntry {
            name: "summary.json".into(),
            content: to_json(&summary)?,
        },
        ZipEntry {
            name: "logs/ainote.log".into(),
            content: input.log_text.into_bytes(),
        },
    ];
    let bytes = diagnostics_files::write_zip(dest, &entries)?;
    Ok(DiagnosticsExportDto {
        path: dest.to_string_lossy().into_owned(),
        bytes,
        files: manifest.files,
    })
}

fn to_json<T: serde::Serialize>(value: &T) -> Result<Vec<u8>, AppError> {
    serde_json::to_vec_pretty(value).map_err(|err| AppError::Io(err.to_string()))
}

#[cfg(test)]
mod tests {
    use std::io::Read;

    use super::*;

    fn input() -> DiagnosticsInput {
        DiagnosticsInput {
            config: DiagnosticsConfigSummary {
                repo_count: 2,
                has_active_repo: true,
                has_token: true,
            },
            sync: Some(SyncStatus {
                ahead: 1,
                behind: 2,
                has_uncommitted: true,
                conflicted: false,
            }),
            repo_size_bytes: Some(1024),
            log_text: "2026-09-10 [ERROR] SYNC_4002\n[WARN] SYNC_4002 GIT_4001\n".into(),
        }
    }

    #[test]
    fn counts_error_codes_sorted() {
        let counts = count_error_codes(&input().log_text);
        assert_eq!(
            counts,
            vec![
                DiagnosticsErrorCount { code: "GIT_4001".into(), count: 1 },
                DiagnosticsErrorCount { code: "SYNC_4002".into(), count: 2 },
            ]
        );
    }

    #[test]
    fn ignores_non_error_tokens() {
        let counts = count_error_codes("2026-09-10 08:20:29 ainote::sync SYNC_40");
        assert!(counts.is_empty());
    }

    #[test]
    fn manifest_lists_whitelisted_files_only() {
        let manifest = build_manifest("0.24.12", "2026-09-10T00:00:00Z");
        assert_eq!(manifest.schema_version, 1);
        assert_eq!(manifest.files, ZIP_ENTRIES.to_vec());
    }

    #[test]
    fn summary_omits_paths_and_content() {
        let summary = build_summary(&input());
        let json = serde_json::to_string(&summary).unwrap();
        assert!(json.contains("\"repoCount\":2"));
        assert!(!json.contains("/Users/"));
        assert!(!json.contains("ghp_"));
    }

    #[test]
    fn exports_zip_with_expected_entries() {
        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("diag.zip");
        let result = export(&dest, input()).unwrap();
        assert_eq!(result.files, ZIP_ENTRIES.to_vec());
        assert!(result.bytes > 0);
        assert!(dest.is_file());
    }

    #[test]
    fn exported_zip_redacts_secrets() {
        let tmp = tempfile::tempdir().unwrap();
        let dest = tmp.path().join("diag.zip");
        let mut data = input();
        data.log_text = concat!(
            "Authorization: Bearer ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n",
            "/Users/jake/secret.md\n",
        )
        .into();
        export(&dest, data).unwrap();

        let mut archive = zip::ZipArchive::new(std::fs::File::open(&dest).unwrap()).unwrap();
        let mut log = String::new();
        archive
            .by_name("logs/ainote.log")
            .unwrap()
            .read_to_string(&mut log)
            .unwrap();
        assert!(!log.contains("ghp_"));
        assert!(!log.contains("/Users/jake"));
        assert!(log.contains("~"));
    }
}
