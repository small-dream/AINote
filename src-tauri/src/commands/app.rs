use tauri::command;

use crate::domain::error::{AppError, AppErrorDto};

/// 纯逻辑：只允许 http/https（与前端 `isExternalHttpUrl` 白名单一致）。
pub(crate) fn is_allowed_external_url(url: &str) -> bool {
    url.starts_with("http://") || url.starts_with("https://")
}

/// 使用系统默认程序打开外部 URL。
/// 禁止用于仓库内部路径或潜在文件路径；仅用于 http/https 链接。
#[command]
pub fn open_external(url: String) -> Result<(), AppErrorDto> {
    if !is_allowed_external_url(&url) {
        return Err(AppError::InvalidPath(format!("unsupported url scheme: {url}")).into());
    }
    opener::open(&url).map_err(|err| AppErrorDto::from(AppError::Io(err.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_http_and_https() {
        assert!(is_allowed_external_url("https://example.com/a"));
        assert!(is_allowed_external_url("http://localhost:1420"));
        assert!(!is_allowed_external_url("mailto:someone@example.com"));
        assert!(!is_allowed_external_url("file:///etc/passwd"));
        assert!(!is_allowed_external_url("javascript:alert(1)"));
        assert!(!is_allowed_external_url(""));
    }

    #[test]
    fn unsupported_scheme_returns_structured_error() {
        let err = open_external("javascript:alert(1)".into()).unwrap_err();
        assert_eq!(err.code, "NOTE_1002", "错误码与前端 AppError 结构一致");
        assert!(!err.retriable);
    }
}
