use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::voice::VoiceSupportDto;
use crate::services::voice_service;

/// Controller：探测系统语音识别能力（无副作用，不弹权限框）。
/// 桌面端恒为不支持，前端据此不渲染麦克风入口。
#[tauri::command]
pub async fn voice_support() -> Result<VoiceSupportDto, AppErrorDto> {
    blocking::run(voice_service::support)
        .await
        .map_err(AppErrorDto::from)
}
