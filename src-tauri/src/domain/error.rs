use serde::Serialize;
use thiserror::Error;

/// 领域错误：Repository 边界在此统一转换，原始错误绝不泄漏到前端。
/// 错误码规范见 docs/CODING_STANDARDS.md 第 3 节。
#[derive(Debug, Error)]
pub enum AppError {
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("repo error: {0}")]
    Repo(String),
    #[error("git error: {0}")]
    Git(String),
    #[error("io error: {0}")]
    Io(String),
}

#[derive(Debug, Clone, Copy, Serialize)]
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
            AppError::Repo(_) => ("REPO_3001", ErrorKind::Unknown, false),
            AppError::Git(_) => ("GIT_4001", ErrorKind::Unknown, true),
            AppError::Io(_) => ("IO_5001", ErrorKind::Io, true),
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
