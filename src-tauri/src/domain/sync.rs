use serde::Serialize;

/// 同步阶段：失败时用于定位是「本地提交 / 拉取 / 推送」哪一步出的问题（E4-T4）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncStage {
    Commit,
    Pull,
    Push,
}

/// 单个冲突文件的三栏合并素材（list_conflicts 返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictFile {
    /// 相对仓库根目录的路径，如 "daily/a.md"
    pub path: String,
    /// 本地侧内容（index stage 2）
    pub local: String,
    /// 远端侧内容（index stage 3）
    pub remote: String,
}

/// 冲突兜底导出结果（export_conflicts 返回）：条目为 `local/<路径>` 与 `remote/<路径>`。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictExportDto {
    pub path: String,
    pub bytes: u64,
    pub files: Vec<String>,
}

/// 同步过程进度（sync_now 经 Tauri Channel 下发）：目前只有自动重试。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgressDto {
    /// 阶段标识，当前固定为 `retrying`
    pub phase: String,
    /// 第几次重试（从 1 开始）
    pub retry: u32,
    pub max_retries: u32,
    /// 本次等待毫秒数
    pub delay_ms: u64,
}

/// 仓库同步状态（sync_status / sync_now / git_pull / git_push 返回）
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub ahead: u32,
    pub behind: u32,
    pub has_uncommitted: bool,
    pub conflicted: bool,
}

/// 文件树节点类型，序列化为 "file" | "dir"
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    File,
    Dir,
}

/// 笔记文件树节点（note_tree 返回）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub node_type: NodeKind,
    pub children: Vec<TreeNode>,
}
