use serde::Serialize;

/// 资产导入结果（import_asset / import_asset_bytes 返回，与 src/api/types.ts 一致）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetInfo {
    /// 相对仓库根目录的路径，如 "assets/2026-08-31-143012.png"
    pub path: String,
}
