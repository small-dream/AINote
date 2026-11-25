use serde::Serialize;

use super::history::DiffLine;

/// 待提交文件相对上次提交（HEAD）的 diff（git_working_diff 返回，与 src/api/types.ts 一致）。
///
/// 语义是 `HEAD` 树 → 工作区，包含已暂存与未暂存改动（提交面板展示的就是这份变更集）。
/// `binary` / `encrypted` / `truncated` 三种不可完整展示的情况由前端给出明确文案，
/// 不把二进制乱码或加密信封当正文返回。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingDiff {
    pub path: String,
    pub lines: Vec<DiffLine>,
    /// 二进制文件：不返回 lines，前端提示无法预览
    pub binary: bool,
    /// 加密笔记：不返回密文 diff，前端提示无法预览明文改动
    pub encrypted: bool,
    /// 改动过大：lines 只是前若干行，前端提示已截断
    pub truncated: bool,
}
