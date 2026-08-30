use serde::Serialize;

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
