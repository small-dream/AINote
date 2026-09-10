use serde::Serialize;
use thiserror::Error;

use crate::domain::sync::SyncStage;

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
    /// 同步网络错误：连接失败 / 超时 / TLS 握手失败（可重试）
    #[error("sync network error: {0}")]
    SyncNetwork(String),
    /// 同步凭证失效：Token 过期、被撤销或认证被拒（需重新登录）
    #[error("sync auth error: {0}")]
    SyncAuth(String),
    /// 同步被远端拒绝：权限不足、分支保护、非快进推送（不可自动重试）
    #[error("sync rejected: {0}")]
    SyncRejected(String),
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
    Network,
    Permission,
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
    /// 同步类错误才有：失败阶段（commit / pull / push），无法归因时为空
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stage: Option<SyncStage>,
    /// 同步类错误才有：可定位到的失败文件（如拉取冲突的文件）
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,
    /// 同步类错误才有：可操作建议的稳定提示码，由前端本地化
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

impl AppErrorDto {
    /// 附加同步定位信息（E4-T4）：`stage` 为空表示无法归因，`files` 为空表示无法定位到文件。
    pub fn with_sync_context(mut self, stage: Option<SyncStage>, files: Vec<String>, hint: &str) -> Self {
        self.stage = stage;
        self.files = files;
        self.hint = Some(hint.to_string());
        self
    }
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
            AppError::SyncNetwork(_) => ("SYNC_4002", ErrorKind::Network, true),
            AppError::SyncAuth(_) => ("SYNC_4003", ErrorKind::Auth, false),
            AppError::SyncRejected(_) => ("SYNC_4004", ErrorKind::Permission, false),
            AppError::Io(_) => ("IO_5001", ErrorKind::Io, true),
            AppError::Ai(_) => ("AI_6001", ErrorKind::Unknown, false),
            AppError::AiNetwork(_) => ("AI_6002", ErrorKind::Unknown, true),
        };
        AppErrorDto {
            code: code.to_string(),
            kind,
            message: err.to_string(),
            retriable,
            stage: None,
            files: Vec::new(),
            hint: None,
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
    fn sync_context_is_opt_in_and_serialized_camel_case() {
        let plain = serde_json::to_value(dto(AppError::SyncNetwork("timeout".into()))).unwrap();
        assert!(plain.get("stage").is_none(), "普通错误不带阶段字段");
        assert!(plain.get("files").is_none(), "无文件时不序列化 files");
        assert!(plain.get("hint").is_none());

        let detailed = dto(AppError::Conflict("merge".into())).with_sync_context(
            Some(SyncStage::Pull),
            vec!["daily/a.md".into()],
            "resolveConflicts",
        );
        let json = serde_json::to_value(detailed).unwrap();
        assert_eq!(json["stage"], "pull");
        assert_eq!(json["hint"], "resolveConflicts");
        assert_eq!(json["files"][0], "daily/a.md");
        assert_eq!(json["code"], "SYNC_4001");
    }

    #[test]
    fn sync_context_accepts_unknown_stage() {
        let json = serde_json::to_value(
            dto(AppError::Git("boom".into())).with_sync_context(None, Vec::new(), "retry"),
        )
        .unwrap();
        assert!(json.get("stage").is_none(), "无法归因时不写 stage");
        assert!(json.get("files").is_none());
        assert_eq!(json["hint"], "retry");
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
        assert_eq!(dto(AppError::SyncNetwork("net".into())).code, "SYNC_4002");
        assert_eq!(dto(AppError::SyncAuth("401".into())).code, "SYNC_4003");
        assert_eq!(dto(AppError::SyncRejected("403".into())).code, "SYNC_4004");
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

    #[test]
    fn maps_sync_error_kinds_and_retriable() {
        let network = dto(AppError::SyncNetwork("timeout".into()));
        assert_eq!(network.kind, ErrorKind::Network);
        assert!(network.retriable);

        let auth = dto(AppError::SyncAuth("bad token".into()));
        assert_eq!(auth.kind, ErrorKind::Auth);
        assert!(!auth.retriable);

        let rejected = dto(AppError::SyncRejected("protected branch".into()));
        assert_eq!(rejected.kind, ErrorKind::Permission);
        assert!(!rejected.retriable);
    }
}
