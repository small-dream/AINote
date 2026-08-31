use serde::{Deserialize, Serialize};

/// 回收站条目（`.trash/manifest.json` 单条；正文存于 `.trash/<id>.md`）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    /// 唯一标识（删除时刻 + 原路径哈希）
    pub id: String,
    /// 删除前的原始相对路径（恢复目标）
    pub path: String,
    /// 删除时间（Unix 秒）
    pub deleted_at: u64,
    /// 删除时解析的笔记标题（避免恢复前重读正文）
    pub title: String,
}
