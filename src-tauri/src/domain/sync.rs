use serde::Serialize;

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
