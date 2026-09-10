use crate::commands::blocking;
use crate::domain::error::AppErrorDto;

/// 单条前端日志的最大字符数，避免异常栈或序列化对象撑爆日志文件。
const MAX_MESSAGE_CHARS: usize = 4_000;

/// Controller：接收前端错误 / 告警并写入统一本地日志（输出前由日志层再次脱敏）。
#[tauri::command]
pub async fn log_frontend(
    level: String,
    message: String,
    context: Option<String>,
) -> Result<(), AppErrorDto> {
    let level = parse_level(&level);
    let line = compose(&message, context.as_deref());
    blocking::run(move || {
        log::log!(target: "ainote::frontend", level, "{line}");
        Ok(())
    })
    .await
    .map_err(AppErrorDto::from)
}

fn parse_level(level: &str) -> log::Level {
    match level {
        "error" => log::Level::Error,
        "warn" => log::Level::Warn,
        _ => log::Level::Info,
    }
}

fn compose(message: &str, context: Option<&str>) -> String {
    let mut line = truncate(message);
    if let Some(context) = context.filter(|value| !value.trim().is_empty()) {
        line.push_str(" | ");
        line.push_str(&truncate(context));
    }
    line
}

fn truncate(value: &str) -> String {
    value.chars().take(MAX_MESSAGE_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_levels_with_info_fallback() {
        assert_eq!(parse_level("error"), log::Level::Error);
        assert_eq!(parse_level("warn"), log::Level::Warn);
        assert_eq!(parse_level("info"), log::Level::Info);
        assert_eq!(parse_level("debug"), log::Level::Info);
    }

    #[test]
    fn composes_message_and_context() {
        assert_eq!(compose("boom", None), "boom");
        assert_eq!(compose("boom", Some("  ")), "boom");
        assert_eq!(compose("boom", Some("at <App>")), "boom | at <App>");
    }

    #[test]
    fn truncates_long_messages() {
        let long = "x".repeat(MAX_MESSAGE_CHARS + 100);
        assert_eq!(truncate(&long).chars().count(), MAX_MESSAGE_CHARS);
    }
}
