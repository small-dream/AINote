use serde::Serialize;

/// 更新包下载进度（经 Tauri Channel 下发；与桌面 UpdateProgress 结构一致）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDownloadProgressDto {
    pub received_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<u32>,
}

/// 下载完成后的 APK 信息。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApkDownloadDto {
    pub path: String,
}

/// 安装调起结果：`needs_permission` 为 true 表示已带用户去系统设置授权，授权后需重新触发安装。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallApkDto {
    pub needs_permission: bool,
}
