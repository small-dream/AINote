use serde::Serialize;
use thiserror::Error;

/// 领域错误：Repository 边界在此统一转换，原始错误绝不泄漏到前端。
/// 错误码规范见 docs/CODING_STANDARDS.md 第 3 节。
#[derive(Debug, Error)]
pub enum AppError {
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("auth error: {0}")]
    Auth(String),
    #[error("network error: {0}")]
    AuthNetwork(String),
    #[error("repo error: {0}")]
    Repo(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("git error: {0}")]
    Git(String),
    #[error("io error: {0}")]
    Io(String),
    /// AI 配置缺失 / Provider 调用失败（不可自动重试）
    #[error("ai error: {0}")]
    Ai(String),
    /// AI Provider 网络错误（可重试）
    #[error("ai network error: {0}")]
    AiNetwork(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ErrorKind {
    NotFound,
    Conflict,
    Auth,
    Io,
    Unknown,
}

/// 传输给前端的结构化错误（与 src/api/error.ts 的 AppError 一致）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorDto {
    pub code: String,
    pub kind: ErrorKind,
    pub message: String,
    pub retriable: bool,
}

impl From<AppError> for AppErrorDto {
    fn from(err: AppError) -> Self {
        let (code, kind, retriable) = match &err {
            AppError::NoteNotFound(_) => ("NOTE_1001", ErrorKind::NotFound, false),
            AppError::InvalidPath(_) => ("NOTE_1002", ErrorKind::Unknown, false),
            AppError::Auth(_) => ("AUTH_2001", ErrorKind::Auth, false),
            AppError::AuthNetwork(_) => ("AUTH_2002", ErrorKind::Auth, true),
            AppError::Repo(_) => ("REPO_3001", ErrorKind::Unknown, false),
            AppError::Conflict(_) => ("SYNC_4001", ErrorKind::Conflict, false),
            AppError::Git(_) => ("GIT_4001", ErrorKind::Unknown, true),
            AppError::Io(_) => ("IO_5001", ErrorKind::Io, true),
            AppError::Ai(_) => ("AI_6001", ErrorKind::Unknown, false),
            AppError::AiNetwork(_) => ("AI_6002", ErrorKind::Unknown, true),
        };
        AppErrorDto {
            code: code.to_string(),
            kind,
            message: err.to_string(),
            retriable,
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dto(err: AppError) -> AppErrorDto {
        err.into()
    }

    #[test]
    fn maps_codes_per_domain() {
        assert_eq!(dto(AppError::NoteNotFound("a".into())).code, "NOTE_1001");
        assert_eq!(dto(AppError::InvalidPath("..".into())).code, "NOTE_1002");
        assert_eq!(dto(AppError::Auth("bad".into())).code, "AUTH_2001");
        assert_eq!(dto(AppError::AuthNetwork("down".into())).code, "AUTH_2002");
        assert_eq!(dto(AppError::Repo("x".into())).code, "REPO_3001");
        assert_eq!(dto(AppError::Conflict("c".into())).code, "SYNC_4001");
        assert_eq!(dto(AppError::Git("g".into())).code, "GIT_4001");
        assert_eq!(dto(AppError::Io("i".into())).code, "IO_5001");
        assert_eq!(dto(AppError::Ai("no key".into())).code, "AI_6001");
        assert_eq!(dto(AppError::AiNetwork("down".into())).code, "AI_6002");
    }

    #[test]
    fn maps_kind_and_retriable() {
        let auth = dto(AppError::Auth("x".into()));
        assert_eq!(auth.kind, ErrorKind::Auth);
        assert!(!auth.retriable);
        let net = dto(AppError::AuthNetwork("x".into()));
        assert_eq!(net.kind, ErrorKind::Auth);
        assert!(net.retriable);
        let conflict = dto(AppError::Conflict("x".into()));
        assert_eq!(conflict.kind, ErrorKind::Conflict);
        assert!(!conflict.retriable);
        let ai = dto(AppError::Ai("bad".into()));
        assert_eq!(ai.kind, ErrorKind::Unknown);
        assert!(!ai.retriable);
        let net = dto(AppError::AiNetwork("down".into()));
        assert!(net.retriable);
    }
}
