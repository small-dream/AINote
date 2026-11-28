use std::sync::Arc;

use tauri::ipc::Channel;

use crate::commands::blocking;
use crate::domain::error::AppErrorDto;
use crate::domain::voice::VoiceStreamEvent;
use crate::services::voice_service;

/// Controller：启动语音识别会话。部分 / 定稿转写经 `on_event` 流式下发；
/// `locale = None` 跟随系统语言；`on_device = false` 表示用户显式选择了联网识别。
/// 已有会话时返回 VOICE_9003，前端切换笔记前必须先 voice_stop（幂等）。
#[tauri::command]
pub async fn voice_start(
    session_id: String,
    locale: Option<String>,
    on_device: bool,
    on_event: Channel<VoiceStreamEvent>,
) -> Result<(), AppErrorDto> {
    let sink: voice_service::VoiceSink = Arc::new(move |event| {
        let _ = on_event.send(event);
    });
    blocking::run(move || voice_service::start(session_id, locale, on_device, sink))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：完成当前会话，最终定稿在停止后经 Channel 补发一次。
#[tauri::command]
pub async fn voice_stop(session_id: String) -> Result<(), AppErrorDto> {
    blocking::run(move || voice_service::finish(&session_id))
        .await
        .map_err(AppErrorDto::from)
}

/// Controller：取消当前会话；迟到 final 会被后端丢弃，不插入当前笔记。
#[tauri::command]
pub async fn voice_cancel(session_id: String) -> Result<(), AppErrorDto> {
    blocking::run(move || voice_service::cancel(&session_id))
        .await
        .map_err(AppErrorDto::from)
}
