use tauri::AppHandle;

use crate::config;
use crate::domain::capture::CaptureSettingsDto;
use crate::domain::error::AppErrorDto;

/// Controller：快速捕捉设置与快捷键注册状态。
#[tauri::command]
pub fn capture_get_settings(app: AppHandle) -> Result<CaptureSettingsDto, AppErrorDto> {
    let fallback = config::capture_shortcut(&app)?;
    #[cfg(desktop)]
    {
        return Ok(crate::platform::capture_shortcut::settings(&app, &fallback));
    }
    #[cfg(not(desktop))]
    {
        Ok(CaptureSettingsDto {
            shortcut: fallback.clone(),
            default_shortcut: crate::services::capture_service::DEFAULT_CAPTURE_SHORTCUT.into(),
            registered: false,
            error: None,
        })
    }
}

/// Controller：修改快捷键；注册失败保留旧值并返回 CAPTURE_10001。
#[tauri::command]
pub fn capture_set_shortcut(
    app: AppHandle,
    shortcut: String,
) -> Result<CaptureSettingsDto, AppErrorDto> {
    let shortcut = shortcut.trim().to_string();
    if shortcut.is_empty() {
        return Err(crate::domain::error::AppError::Capture("快捷键不能为空".into()).into());
    }
    #[cfg(desktop)]
    let previous = config::capture_shortcut(&app)?;
    #[cfg(desktop)]
    crate::platform::capture_shortcut::replace(&app, &shortcut)?;
    if let Err(error) = config::set_capture_shortcut(&app, &shortcut) {
        #[cfg(desktop)]
        let _ = crate::platform::capture_shortcut::replace(&app, &previous);
        return Err(error.into());
    }
    capture_get_settings(app)
}

/// Controller：恢复默认快捷键。
#[tauri::command]
pub fn capture_reset_shortcut(app: AppHandle) -> Result<CaptureSettingsDto, AppErrorDto> {
    capture_set_shortcut(
        app,
        crate::services::capture_service::DEFAULT_CAPTURE_SHORTCUT.to_string(),
    )
}
