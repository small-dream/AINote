//! 结构化本地日志。
//!
//! - 默认写入平台日志目录（`app_log_dir`），debug 构建额外输出 stdout。
//! - 单文件 5MB，保留最近 4 个文件，总占用约 20MB。
//! - 所有输出统一经过 [`redact`]：Token / API Key / Authorization / URL 凭据 / 用户目录不外泄。
//! - 写入失败由 `tauri-plugin-log` 内部降级到 stderr，不影响主流程。

use std::sync::OnceLock;

use regex::Regex;
use tauri::plugin::TauriPlugin;
use tauri::Runtime;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

const MAX_FILE_SIZE: u128 = 5 * 1024 * 1024;
const KEEP_FILES: usize = 4;
const LOG_FILE_NAME: &str = "ainote";

const TIME_FORMAT: &[time::format_description::FormatItem<'_>] =
    time::macros::format_description!("[year]-[month]-[day] [hour]:[minute]:[second]");

/// 注册日志插件：桌面与移动共用同一格式，保证两端都能定位时间 / 模块 / 级别。
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let mut targets = vec![Target::new(TargetKind::LogDir {
        file_name: Some(LOG_FILE_NAME.into()),
    })];
    #[cfg(debug_assertions)]
    targets.push(Target::new(TargetKind::Stdout));

    tauri_plugin_log::Builder::new()
        .level(log::LevelFilter::Info)
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .max_file_size(MAX_FILE_SIZE)
        .rotation_strategy(RotationStrategy::KeepSome(KEEP_FILES))
        .format(|out, message, record| {
            let line = format_line(record.target(), record.level(), &message.to_string());
            out.finish(format_args!("{line}"))
        })
        .targets(targets)
        .build()
}

/// 统一行格式：`YYYY-MM-DD HH:MM:SS[target][LEVEL] message`（message 已脱敏）。
fn format_line(target: &str, level: log::Level, message: &str) -> String {
    let timestamp = time::OffsetDateTime::now_local()
        .unwrap_or_else(|_| time::OffsetDateTime::now_utc())
        .format(TIME_FORMAT)
        .unwrap_or_else(|_| "unknown-time".into());
    format!("{timestamp}[{target}][{level}] {}", redact(message))
}

/// 日志脱敏：抹掉凭证，把用户目录替换为 `~`，其余结构保留以便定位问题。
pub fn redact(input: &str) -> String {
    let mut output = input.to_string();
    for (pattern, replacement) in redaction_rules() {
        output = pattern.replace_all(&output, *replacement).into_owned();
    }
    output
}

fn redaction_rules() -> &'static [(Regex, &'static str)] {
    static RULES: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    RULES.get_or_init(|| {
        vec![
            (
                Regex::new(r"(?i)(authorization\s*[:=]\s*)(?:bearer\s+|token\s+)?\S+").unwrap(),
                "${1}***",
            ),
            (Regex::new(r"(?i)\bbearer\s+[A-Za-z0-9._\-]+").unwrap(), "Bearer ***"),
            (Regex::new(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b").unwrap(), "***"),
            (Regex::new(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b").unwrap(), "***"),
            (Regex::new(r"\bsk-[A-Za-z0-9_\-]{16,}\b").unwrap(), "***"),
            (
                Regex::new(r#"(?i)\b(api[_-]?key|token|password|secret)\b"?\s*[:=]\s*"?[^"\s,}]+"#)
                    .unwrap(),
                "${1}: ***",
            ),
            (Regex::new(r"https?://[^/\s:@]+(?::[^/\s@]*)?@").unwrap(), "https://***@"),
            (Regex::new(r"/Users/[^/\s]+").unwrap(), "~"),
            (Regex::new(r"/home/[^/\s]+").unwrap(), "~"),
            (Regex::new(r"(?i)[A-Za-z]:\\Users\\[^\\\s]+").unwrap(), "~"),
        ]
    })
}

#[cfg(test)]
mod tests {
    use super::redact;

    #[test]
    fn redacts_github_tokens() {
        let output = redact("clone failed with ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
        assert!(!output.contains("ghp_"));
        assert!(output.contains("***"));
    }

    #[test]
    fn redacts_authorization_header() {
        assert_eq!(redact("Authorization: Bearer abc.def-123"), "Authorization: ***");
        assert_eq!(redact("authorization=token ghp_secret"), "authorization=***");
    }

    #[test]
    fn redacts_api_keys_and_secret_pairs() {
        let output = redact(r#"{"apiKey":"sk-1234567890abcdefghij"}"#);
        assert!(!output.contains("sk-1234567890abcdefghij"));
        assert_eq!(redact("token=secret_value"), "token: ***");
    }

    #[test]
    fn redacts_url_credentials() {
        assert_eq!(
            redact("https://user:pass@github.com/a/b.git"),
            "https://***@github.com/a/b.git"
        );
        assert_eq!(
            redact("https://ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@github.com/a/b.git"),
            "https://***@github.com/a/b.git"
        );
    }

    #[test]
    fn redacts_user_home_paths() {
        assert_eq!(redact("/Users/jake/AI/AINote/a.md"), "~/AI/AINote/a.md");
        assert_eq!(redact("/home/alice/notes"), "~/notes");
        assert_eq!(redact(r"C:\Users\Alice\notes"), r"~\notes");
    }

    #[test]
    fn keeps_plain_text_untouched() {
        let text = "sync pull failed: connection reset";
        assert_eq!(redact(text), text);
    }

    #[test]
    fn formats_line_with_time_target_level_and_redaction() {
        let line = super::format_line("ainote::sync", log::Level::Error, "token=secret failed");
        assert!(line.contains("[ainote::sync][ERROR]"));
        assert!(line.contains("token: ***"));
        assert!(!line.contains("secret"));
        let stamp = &line[..19];
        assert_eq!(stamp.chars().filter(|c| *c == '-').count(), 2);
        assert_eq!(stamp.chars().filter(|c| *c == ':').count(), 2);
        assert!(stamp
            .chars()
            .all(|c| c.is_ascii_digit() || c == '-' || c == ' ' || c == ':'));
    }
}
