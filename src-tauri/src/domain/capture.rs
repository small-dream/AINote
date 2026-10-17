use serde::{Deserialize, Serialize};

/// 快速捕捉设置（设置页展示与快捷键注册状态）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSettingsDto {
    pub shortcut: String,
    pub default_shortcut: String,
    pub registered: bool,
    pub error: Option<String>,
}

/// 捕获写入请求；share_intake_id 只允许引用 Android 分享写入的临时 intake。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureInputDto {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub share_intake_id: Option<String>,
}

/// Android 系统分享暂存项。图片内容只存在于 app cache，不进入前端持久态。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedCaptureDto {
    pub id: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub subject: Option<String>,
    pub image_path: Option<String>,
    pub image_name: Option<String>,
}
