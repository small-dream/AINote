//! libgit2 错误的同步语义分类。
//!
//! 只用于网络操作（clone / ls_remote / fetch / push / pull），把「网络异常 / 凭证失效 /
//! 远端拒绝」从统一的 `AppError::Git` 中拆出来，让前端能给出可操作提示。
//! 本地操作仍走 `git2_backend::to_git`，避免误分类。

use git2::ErrorClass;

use crate::domain::error::AppError;

/// 同步错误的语义类别（纯值类型，便于单测）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SyncErrorKind {
    Auth,
    Network,
    Rejected,
    Other,
}

const AUTH_HINTS: [&str; 6] = [
    "401",
    "unauthorized",
    "authentication failed",
    "invalid credentials",
    "could not read username",
    "terminal prompts disabled",
];

const REJECTED_HINTS: [&str; 6] = [
    "403",
    "forbidden",
    "non-fast-forward",
    "rejected",
    "pre-receive hook declined",
    "protected branch",
];

const NETWORK_HINTS: [&str; 8] = [
    "timeout",
    "timed out",
    "connection reset",
    "connection refused",
    "failed to connect",
    "could not resolve host",
    "network is unreachable",
    "tls",
];

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}

/// 根据 libgit2 错误类别与消息判定同步错误类型。
///
/// 判定顺序：凭证 → 远端拒绝 → 网络 → 其他。HTTP 401/403 的语义由消息中的状态码决定，
/// 因此必须排在按 class 粗分类的 `Network` 之前。
pub(crate) fn classify(class: ErrorClass, message: &str) -> SyncErrorKind {
    let lower = message.to_ascii_lowercase();
    if matches!(class, ErrorClass::Ssh | ErrorClass::Callback) {
        return SyncErrorKind::Auth;
    }
    if contains_any(&lower, &AUTH_HINTS) {
        return SyncErrorKind::Auth;
    }
    if contains_any(&lower, &REJECTED_HINTS) {
        return SyncErrorKind::Rejected;
    }
    if matches!(class, ErrorClass::Net | ErrorClass::Ssl | ErrorClass::Http)
        || contains_any(&lower, &NETWORK_HINTS)
    {
        return SyncErrorKind::Network;
    }
    SyncErrorKind::Other
}

/// 把网络操作的 libgit2 错误转成带语义的 `AppError`；无法判定时退回通用 Git 错误。
/// 消息统一过 `redact`：libgit2 原文可能含本机绝对路径或 URL 内嵌凭证，不透传到前端。
pub(crate) fn to_sync(err: git2::Error) -> AppError {
    let message = crate::config::logging::redact(err.message());
    match classify(err.class(), &message) {
        SyncErrorKind::Auth => AppError::SyncAuth(message),
        SyncErrorKind::Network => AppError::SyncNetwork(message),
        SyncErrorKind::Rejected => AppError::SyncRejected(message),
        SyncErrorKind::Other => AppError::Git(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_auth_errors() {
        assert_eq!(classify(ErrorClass::Ssh, "ssh key rejected"), SyncErrorKind::Auth);
        assert_eq!(classify(ErrorClass::Callback, "credentials callback failed"), SyncErrorKind::Auth);
        assert_eq!(classify(ErrorClass::Http, "401 Unauthorized"), SyncErrorKind::Auth);
        assert_eq!(
            classify(ErrorClass::None, "Authentication failed for 'https://github.com/x/y'"),
            SyncErrorKind::Auth
        );
    }

    #[test]
    fn classifies_rejected_errors() {
        assert_eq!(classify(ErrorClass::Http, "403 Forbidden"), SyncErrorKind::Rejected);
        assert_eq!(classify(ErrorClass::Reference, "non-fast-forward"), SyncErrorKind::Rejected);
        assert_eq!(
            classify(ErrorClass::None, "pre-receive hook declined"),
            SyncErrorKind::Rejected
        );
    }

    #[test]
    fn classifies_network_errors() {
        assert_eq!(classify(ErrorClass::Net, "unable to connect"), SyncErrorKind::Network);
        assert_eq!(classify(ErrorClass::Ssl, "handshake failed"), SyncErrorKind::Network);
        assert_eq!(
            classify(ErrorClass::None, "Could not resolve host: github.com"),
            SyncErrorKind::Network
        );
        assert_eq!(classify(ErrorClass::None, "operation timed out"), SyncErrorKind::Network);
    }

    #[test]
    fn keeps_unknown_as_git_error() {
        assert_eq!(classify(ErrorClass::Repository, "object not found"), SyncErrorKind::Other);
    }

    #[test]
    fn maps_network_message_to_sync_network_variant() {
        let err = git2::Error::from_str("Could not resolve host: github.com");
        assert!(matches!(to_sync(err), AppError::SyncNetwork(_)));
    }

    #[test]
    fn to_sync_redacts_local_paths_in_message() {
        let err = git2::Error::from_str("failed to lock /Users/jake/notes/.git/index.lock");
        let AppError::Git(message) = to_sync(err) else {
            panic!("本地错误应归为 Git 变体");
        };
        assert!(!message.contains("/Users/jake"), "不透传本机绝对路径");
        assert!(message.contains("~/notes/.git/index.lock"));
    }
}
