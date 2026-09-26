use serde::Serialize;
use thiserror::Error;

use crate::domain::sync::SyncStage;

/// 领域错误：Repository 边界在此统一转换，原始错误绝不泄漏到前端。
/// 错误码规范见 docs/CODING_STANDARDS.md §4。
#[derive(Debug, Error)]
pub enum AppError {
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("auth error: {0}")]
    Auth(String),
    /// 目标平台尚未配置访问令牌：可操作错误，DTO 会带上平台 id 供前端直接引导登录。
    #[error("auth error: 尚未配置 {display_name} 的访问令牌，请先登录 {display_name} 账号")]
    AuthLoginRequired {
        provider: String,
        display_name: String,
    },
    #[error("network error: {0}")]
    AuthNetwork(String),
    #[error("repo error: {0}")]
    Repo(String),
    /// 目录内存在非笔记文件（图片等），拒绝删除以避免不可恢复的数据丢失（消息列出前几个文件名）
    #[error("{0}")]
    FolderHasNonNoteFiles(String),
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
    /// 同一仓库已有同步/写操作进行中：防重入，用户稍后重试即可。
    /// 消息直接进全局 toast，故不带英文前缀（同 FolderHasNonNoteFiles 先例）。
    #[error("{0}")]
    SyncBusy(String),
    /// 仓库处于未解决的合并冲突中：丢弃工作区改动会破坏 merge 状态，必须先解决冲突。
    /// 消息直接进全局 toast，故不带英文前缀（同 SyncBusy 先例）。
    #[error("{0}")]
    DiscardBlocked(String),
    #[error("io error: {0}")]
    Io(String),
    /// AI 配置缺失 / Provider 调用失败（不可自动重试）
    #[error("ai error: {0}")]
    Ai(String),
    /// AI Provider 网络错误（可重试）
    #[error("ai network error: {0}")]
    AiNetwork(String),
    /// 更新包下载失败（网络中断等，可重试）
    #[error("update download error: {0}")]
    UpdateDownload(String),
    /// 更新包校验和不匹配（下载可能被篡改或损坏，不自动重试）
    #[error("update checksum mismatch: {0}")]
    UpdateChecksum(String),
    /// 应用内安装不可用（非 Android 平台或系统桥调用失败）
    #[error("update install unavailable: {0}")]
    UpdateInstall(String),
    /// 已有更新下载进行中：防重入，稍后重试即可（消息直接进全局 toast）
    #[error("{0}")]
    UpdateBusy(String),
    /// 已有备份导出进行中：防重入，稍后重试即可（消息直接进全局 toast）
    #[error("{0}")]
    BackupBusy(String),
    #[error("task not found: {0}")]
    TaskNotFound(String),
    /// 任务字段校验失败（空标题、提醒时间缺少截止日期等）
    #[error("invalid task: {0}")]
    TaskInvalid(String),
    /// 加密笔记：仓库已建库但当前会话未解锁（或该笔记为加密态）
    #[error("vault locked: {0}")]
    VaultLocked(String),
    /// 加密笔记：口令错误，或仓库密钥文件无法解封（两者对外不可区分）
    #[error("vault unlock failed: {0}")]
    VaultUnlockFailed(String),
    /// 加密笔记不提供版本历史（Diff 与恢复此版本均不可用）
    #[error("vault history unavailable: {0}")]
    VaultHistoryUnavailable(String),
    /// 加密笔记输入/配置非法：口令强度不足、vault.json 格式非法、信封格式非法
    #[error("invalid vault input: {0}")]
    VaultInvalid(String),
    /// 密文校验失败：文件已损坏或被人为篡改
    #[error("vault corrupt: {0}")]
    VaultCorrupt(String),
    /// 设备级快速解锁不可用：平台不支持、本机未开启，或设备条目已失效（需用口令解锁后重新开启）
    #[error("vault quick unlock unavailable: {0}")]
    VaultQuickUnlockUnavailable(String),
    /// 设备认证被用户主动取消：前端静默处理，不显示红色错误
    #[error("vault device auth cancelled: {0}")]
    VaultDeviceAuthCancelled(String),
    /// 设备认证失败：未录入生物识别、被系统锁定、密钥失效等（可重试或用口令解锁）
    #[error("vault device auth failed: {0}")]
    VaultDeviceAuthFailed(String),
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
    /// 认证类错误才有：需要登录的托管平台 id，前端据此直接发起登录
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
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
    /// 认证类错误补上目标平台 id（前端可据此直接引导登录），其它错误原样返回。
    pub fn with_auth_provider(mut self, provider: &str) -> Self {
        if matches!(self.kind, ErrorKind::Auth) && self.provider.is_none() {
            self.provider = Some(provider.to_string());
        }
        self
    }

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
            AppError::AuthLoginRequired { .. } => ("AUTH_2001", ErrorKind::Auth, false),
            AppError::AuthNetwork(_) => ("AUTH_2002", ErrorKind::Auth, true),
            AppError::Repo(_) => ("REPO_3001", ErrorKind::Unknown, false),
            AppError::FolderHasNonNoteFiles(_) => ("REPO_3002", ErrorKind::Unknown, false),
            AppError::Conflict(_) => ("SYNC_4001", ErrorKind::Conflict, false),
            AppError::Git(_) => ("GIT_4001", ErrorKind::Unknown, false),
            AppError::SyncNetwork(_) => ("SYNC_4002", ErrorKind::Network, true),
            AppError::SyncAuth(_) => ("SYNC_4003", ErrorKind::Auth, false),
            AppError::SyncRejected(_) => ("SYNC_4004", ErrorKind::Permission, false),
            AppError::SyncBusy(_) => ("SYNC_4005", ErrorKind::Conflict, true),
            AppError::DiscardBlocked(_) => ("SYNC_4006", ErrorKind::Conflict, true),
            AppError::Io(_) => ("IO_5001", ErrorKind::Io, true),
            AppError::Ai(_) => ("AI_6001", ErrorKind::Unknown, false),
            AppError::AiNetwork(_) => ("AI_6002", ErrorKind::Unknown, true),
            AppError::UpdateDownload(_) => ("UPDATE_7001", ErrorKind::Network, true),
            AppError::UpdateChecksum(_) => ("UPDATE_7002", ErrorKind::Unknown, false),
            AppError::UpdateInstall(_) => ("UPDATE_7003", ErrorKind::Unknown, false),
            AppError::UpdateBusy(_) => ("UPDATE_7004", ErrorKind::Conflict, true),
            AppError::BackupBusy(_) => ("REPO_3003", ErrorKind::Conflict, true),
            AppError::TaskNotFound(_) => ("TASK_8001", ErrorKind::NotFound, false),
            AppError::TaskInvalid(_) => ("TASK_8003", ErrorKind::Unknown, false),
            AppError::VaultLocked(_) => ("VAULT_9001", ErrorKind::Permission, false),
            AppError::VaultUnlockFailed(_) => ("VAULT_9002", ErrorKind::Auth, false),
            AppError::VaultHistoryUnavailable(_) => ("VAULT_9003", ErrorKind::Unknown, false),
            AppError::VaultInvalid(_) => ("VAULT_9004", ErrorKind::Unknown, false),
            AppError::VaultCorrupt(_) => ("VAULT_9005", ErrorKind::Unknown, false),
            AppError::VaultQuickUnlockUnavailable(_) => ("VAULT_9006", ErrorKind::Unknown, false),
            AppError::VaultDeviceAuthCancelled(_) => ("VAULT_9007", ErrorKind::Unknown, false),
            AppError::VaultDeviceAuthFailed(_) => ("VAULT_9008", ErrorKind::Unknown, false),
        };
        let provider = match &err {
            AppError::AuthLoginRequired { provider, .. } => Some(provider.clone()),
            _ => None,
        };
        AppErrorDto {
            code: code.to_string(),
            kind,
            message: err.to_string(),
            retriable,
            provider,
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

impl AppError {
    /// Repository 边界：`io::Error` 本身不含文件名，补上「操作 + 路径」上下文前端才能定位。
    pub fn io_context(action: &str, path: &std::path::Path, err: std::io::Error) -> Self {
        AppError::Io(format!("{action} {}: {err}", path.display()))
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
        assert_eq!(
            dto(AppError::AuthLoginRequired {
                provider: "gitee".into(),
                display_name: "Gitee".into(),
            })
            .code,
            "AUTH_2001"
        );
        assert_eq!(dto(AppError::AuthNetwork("down".into())).code, "AUTH_2002");
        assert_eq!(dto(AppError::Repo("x".into())).code, "REPO_3001");
        let folder_err = dto(AppError::FolderHasNonNoteFiles("pic.png".into()));
        assert_eq!(folder_err.code, "REPO_3002");
        assert!(!folder_err.retriable, "数据安全拒绝不可自动重试");
        assert_eq!(dto(AppError::Conflict("c".into())).code, "SYNC_4001");
        assert_eq!(dto(AppError::Git("g".into())).code, "GIT_4001");
        assert_eq!(dto(AppError::SyncNetwork("net".into())).code, "SYNC_4002");
        assert_eq!(dto(AppError::SyncAuth("401".into())).code, "SYNC_4003");
        assert_eq!(dto(AppError::SyncRejected("403".into())).code, "SYNC_4004");
        assert_eq!(dto(AppError::SyncBusy("进行中".into())).code, "SYNC_4005");
        let discard_blocked = dto(AppError::DiscardBlocked("存在未解决的合并冲突".into()));
        assert_eq!(discard_blocked.code, "SYNC_4006");
        assert!(discard_blocked.retriable, "解决冲突后可重试");
        assert_eq!(discard_blocked.message, "存在未解决的合并冲突", "消息不带英文前缀");
        assert_eq!(dto(AppError::Io("i".into())).code, "IO_5001");
        assert_eq!(dto(AppError::Ai("no key".into())).code, "AI_6001");
        assert_eq!(dto(AppError::AiNetwork("down".into())).code, "AI_6002");
        assert_eq!(dto(AppError::UpdateDownload("net".into())).code, "UPDATE_7001");
        assert_eq!(dto(AppError::UpdateChecksum("bad".into())).code, "UPDATE_7002");
        assert_eq!(dto(AppError::UpdateInstall("bridge".into())).code, "UPDATE_7003");
        let update_busy = dto(AppError::UpdateBusy("下载中".into()));
        assert_eq!(update_busy.code, "UPDATE_7004");
        assert!(update_busy.retriable, "防重入错误稍后重试即可");
        assert_eq!(update_busy.message, "下载中", "Busy 消息不带英文前缀");
        let backup_busy = dto(AppError::BackupBusy("备份中".into()));
        assert_eq!(backup_busy.code, "REPO_3003");
        assert!(backup_busy.retriable);
        assert_eq!(backup_busy.message, "备份中");
        assert_eq!(dto(AppError::TaskNotFound("t".into())).code, "TASK_8001");
        assert_eq!(dto(AppError::TaskInvalid("bad".into())).code, "TASK_8003");
        assert_eq!(dto(AppError::VaultLocked("locked".into())).code, "VAULT_9001");
        assert_eq!(
            dto(AppError::VaultUnlockFailed("bad passphrase".into())).code,
            "VAULT_9002"
        );
        assert_eq!(
            dto(AppError::VaultHistoryUnavailable("encrypted".into())).code,
            "VAULT_9003"
        );
        assert_eq!(dto(AppError::VaultInvalid("weak".into())).code, "VAULT_9004");
        assert_eq!(dto(AppError::VaultCorrupt("tampered".into())).code, "VAULT_9005");
        assert_eq!(
            dto(AppError::VaultQuickUnlockUnavailable("stale".into())).code,
            "VAULT_9006"
        );
        assert_eq!(
            dto(AppError::VaultDeviceAuthCancelled("cancel".into())).code,
            "VAULT_9007"
        );
        assert_eq!(
            dto(AppError::VaultDeviceAuthFailed("no biometrics".into())).code,
            "VAULT_9008"
        );
    }

    #[test]
    fn vault_errors_are_not_retriable_and_keep_expected_kind() {
        let locked = dto(AppError::VaultLocked("locked".into()));
        assert_eq!(locked.kind, ErrorKind::Permission);
        assert!(!locked.retriable);

        let unlock = dto(AppError::VaultUnlockFailed("bad".into()));
        assert_eq!(unlock.kind, ErrorKind::Auth);
        assert!(!unlock.retriable);

        let history = dto(AppError::VaultHistoryUnavailable("encrypted".into()));
        assert_eq!(history.kind, ErrorKind::Unknown);
        assert!(!history.retriable);

        assert!(!dto(AppError::VaultInvalid("weak".into())).retriable);
        assert!(!dto(AppError::VaultCorrupt("tampered".into())).retriable);
        // 设备认证失败可重试（用户可再试一次或改用口令），但都不是认证类错误。
        assert_eq!(
            dto(AppError::VaultDeviceAuthFailed("locked out".into())).kind,
            ErrorKind::Unknown
        );
        assert_eq!(
            dto(AppError::VaultDeviceAuthCancelled("cancel".into())).kind,
            ErrorKind::Unknown
        );
        assert_eq!(
            dto(AppError::VaultQuickUnlockUnavailable("stale".into())).kind,
            ErrorKind::Unknown
        );
    }

    #[test]
    fn maps_kind_and_retriable() {
        let auth = dto(AppError::Auth("x".into()));
        assert_eq!(auth.kind, ErrorKind::Auth);
        assert!(!auth.retriable);
        assert!(auth.provider.is_none(), "无平台信息的认证错误不写 provider");
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

        let busy = dto(AppError::SyncBusy("同步进行中".into()));
        assert_eq!(busy.kind, ErrorKind::Conflict);
        assert!(busy.retriable, "防重入错误稍后重试即可");
    }

    #[test]
    fn local_git_errors_are_not_retriable() {
        assert!(!dto(AppError::Git("index lock".into())).retriable);
    }

    #[test]
    fn login_required_error_carries_provider_for_the_ui() {
        let json = serde_json::to_value(dto(AppError::AuthLoginRequired {
            provider: "github".into(),
            display_name: "GitHub".into(),
        }))
        .unwrap();
        assert_eq!(json["code"], "AUTH_2001");
        assert_eq!(json["kind"], "auth");
        assert_eq!(json["provider"], "github");
        assert_eq!(
            json["message"],
            "auth error: 尚未配置 GitHub 的访问令牌，请先登录 GitHub 账号"
        );
    }

    #[test]
    fn auth_provider_hint_fills_only_auth_errors() {
        let filled = dto(AppError::Auth("bad".into())).with_auth_provider("gitee");
        assert_eq!(filled.provider.as_deref(), Some("gitee"));

        // 已带平台的错误不被覆盖。
        let kept = dto(AppError::AuthLoginRequired {
            provider: "github".into(),
            display_name: "GitHub".into(),
        })
        .with_auth_provider("gitee");
        assert_eq!(kept.provider.as_deref(), Some("github"));

        // 非认证错误不写平台，避免误导用户去登录。
        let untouched = dto(AppError::Git("boom".into())).with_auth_provider("gitee");
        assert!(untouched.provider.is_none());
        assert!(serde_json::to_value(untouched).unwrap().get("provider").is_none());
    }

    #[test]
    fn io_context_carries_action_and_path() {
        let err = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        let AppError::Io(message) =
            AppError::io_context("写入失败", std::path::Path::new("daily/a.md"), err)
        else {
            panic!("应为 IO 错误");
        };
        assert_eq!(message, "写入失败 daily/a.md: no such file");
    }
}
