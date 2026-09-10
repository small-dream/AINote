use serde::Serialize;

use super::sync::ChangedFile;

/// 单条提交（git_file_history 返回，与 src/api/types.ts 的 CommitInfo 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    /// 提交时间（Unix 秒）
    pub timestamp: u64,
}

/// diff 行类型（前端据此着色）
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKind {
    Added,
    Removed,
    Context,
}

/// 单文件 diff 的一行（text 不含 +/- 前缀）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: DiffLineKind,
    pub text: String,
}

/// 选中提交相对其父提交的单文件 diff
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub commit_id: String,
    pub lines: Vec<DiffLine>,
}

/// Repo Git Graph 的一条提交（含其直接改动的文件，git_repo_history 返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoCommit {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author: String,
    /// 提交时间（Unix 秒）
    pub timestamp: u64,
    /// 全部父提交 id（merge commit 有多个）
    pub parents: Vec<String>,
    /// 相对首父提交直接改动的文件（A/M/D）；根提交按首次引入计算
    pub files: Vec<ChangedFile>,
}
