use serde::{Deserialize, Serialize};

/// 备份包 manifest.json：写入 zip 最后一个条目，`sha256` 覆盖此前所有内容条目。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub schema_version: u32,
    pub app_version: String,
    pub repo_name: String,
    pub created_at: String,
    pub file_count: usize,
    pub total_bytes: u64,
    /// 内容摘要：按写入顺序对「条目名 + 长度 + 内容」逐字节哈希所得十六进制串。
    pub sha256: String,
    pub includes_assets: bool,
}

/// 备份导出结果。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupExportDto {
    pub path: String,
    pub bytes: u64,
    pub file_count: usize,
    pub total_bytes: u64,
}

/// 备份阶段：扫描文件列表 / 写入压缩包。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupPhase {
    Scanning,
    Writing,
}

/// 备份进度事件（经 Tauri Channel 下发）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupProgressDto {
    pub phase: BackupPhase,
    pub processed: usize,
    pub total: usize,
}
