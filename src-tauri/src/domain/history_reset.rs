//! 历史重置（设置 → 仓库 → 危险区）：把仓库折叠成「工作区现状 = 唯一一次提交」。
//!
//! 领域层只放值类型与纯函数：不依赖 git2、文件系统与 Tauri。

use serde::Serialize;

/// 重置前的仓库快照：既是重建新仓库所需的元数据，也是拒绝执行的前置依据。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RepoSnapshot {
    /// 当前分支 shorthand（如 `main`）：新仓库沿用同名分支，避免 main/master 漂移
    pub branch: String,
    /// origin 地址；无远端时为 None（本地仓库只重建、不推送）
    pub remote_url: Option<String>,
    /// 相对上游领先的提交数
    pub ahead: u32,
    /// 相对上游落后的提交数：> 0 表示远端有别人的提交，必须拒绝重置
    pub behind: u32,
    /// 即将被清除的提交总数（旧 HEAD 可达的全部提交）
    pub commits: u32,
}

/// 重建后得到的单次提交
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RebuiltCommit {
    pub commit_id: String,
    /// 这次提交包含的文件数（index 条目数）
    pub files: u32,
}

/// 重置结果（前端展示与提示用）
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResetReport {
    pub commit_id: String,
    pub branch: String,
    /// 被清除的提交数
    pub erased_commits: u32,
    /// 这次提交包含的文件数
    pub file_count: u32,
    /// 是否已强制推送到 origin（本地仓库为 false）
    pub pushed: bool,
    /// 旧仓库备份清理失败：仓库同级目录里仍留着 `.ainote-git-backup-*`，需手动删除
    /// （下一次执行时也会自愈清理）
    pub backup_cleanup_failed: bool,
}

/// 提交说明长度上限：够表达「为什么重置」即可，避免超长说明塞进单次提交。
pub const MAX_MESSAGE_LEN: usize = 200;

/// 纯函数：规范化并校验提交说明；空白与超长返回 None。
pub fn normalize_message(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_MESSAGE_LEN {
        return None;
    }
    Some(trimmed.to_string())
}

/// 纯函数：不允许重置的原因（None = 可以重置）。
///
/// 远端领先时强制推送会直接丢掉其它设备刚提交的内容，因此必须先同步。
pub fn blocking_reason(snapshot: &RepoSnapshot) -> Option<&'static str> {
    if snapshot.behind > 0 {
        Some("远端有本地尚未同步的提交，请先同步再重置历史")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(behind: u32) -> RepoSnapshot {
        RepoSnapshot {
            branch: "main".into(),
            remote_url: Some("https://github.com/me/notes.git".into()),
            ahead: 2,
            behind,
            commits: 5,
        }
    }

    #[test]
    fn message_is_trimmed() {
        assert_eq!(normalize_message("  note: reset  "), Some("note: reset".into()));
    }

    #[test]
    fn blank_message_is_rejected() {
        assert_eq!(normalize_message("   \n"), None);
    }

    #[test]
    fn overlong_message_is_rejected() {
        assert_eq!(normalize_message(&"x".repeat(MAX_MESSAGE_LEN + 1)), None);
        assert!(normalize_message(&"x".repeat(MAX_MESSAGE_LEN)).is_some());
    }

    #[test]
    fn behind_blocks_reset() {
        assert_eq!(blocking_reason(&snapshot(0)), None);
        assert!(blocking_reason(&snapshot(1)).is_some());
    }
}
