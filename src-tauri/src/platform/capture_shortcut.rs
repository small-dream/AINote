//! 桌面快速捕捉全局快捷键：注册、替换与状态快照。
//! 只由 Rust 侧调用插件，前端不直接持有全局快捷键权限。

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::domain::capture::CaptureSettingsDto;
use crate::domain::error::AppError;

#[derive(Default)]
pub struct CaptureShortcutState {
    current: Mutex<Option<String>>,
    error: Mutex<Option<String>>,
}

impl CaptureShortcutState {
    fn set(&self, shortcut: Option<String>, error: Option<String>) {
        *self.current.lock().unwrap() = shortcut;
        *self.error.lock().unwrap() = error;
    }

    pub fn snapshot(&self, fallback: &str) -> CaptureSettingsDto {
        let current = self.current.lock().unwrap().clone();
        let error = self.error.lock().unwrap().clone();
        CaptureSettingsDto {
            shortcut: current.clone().unwrap_or_else(|| fallback.to_string()),
            default_shortcut: crate::services::capture_service::DEFAULT_CAPTURE_SHORTCUT
                .to_string(),
            registered: current.is_some(),
            error,
        }
    }
}

/// 启动时注册配置中的快捷键；失败只记录状态，不阻断应用启动。
pub fn init(app: &AppHandle, shortcut: &str) {
    if let Err(error) = replace(app, shortcut) {
        log::warn!(target: "ainote::capture", "快速捕捉快捷键注册失败 shortcut={shortcut}: {error}");
        app.state::<CaptureShortcutState>()
            .set(None, Some(error.to_string()));
    }
}

/// 替换当前快捷键。新组合注册失败时恢复旧组合并返回 CAPTURE_10001。
pub fn replace(app: &AppHandle, shortcut: &str) -> Result<(), AppError> {
    let state = app.state::<CaptureShortcutState>();
    let old = state.current.lock().unwrap().clone();
    if old.as_deref() == Some(shortcut) {
        return Ok(());
    }
    if let Some(previous) = old.as_deref() {
        let _ = app.global_shortcut().unregister(previous);
    }
    match app
        .global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            crate::platform::tray::reveal_main_window(app);
            if let Err(error) = app.emit("capture:open", ()) {
                log::warn!(target: "ainote::capture", "发送快速捕捉事件失败: {error}");
            }
        }) {
        Ok(()) => {
            state.set(Some(shortcut.to_string()), None);
            Ok(())
        }
        Err(error) => {
            if let Some(previous) = old.as_deref() {
                let _ = app
                    .global_shortcut()
                    .on_shortcut(previous, |app, _shortcut, event| {
                        if event.state == ShortcutState::Pressed {
                            crate::platform::tray::reveal_main_window(app);
                            let _ = app.emit("capture:open", ());
                        }
                    });
            }
            let message = format!("快捷键不可用（可能被其他应用占用）：{error}");
            state.set(old, Some(message.clone()));
            Err(AppError::Capture(message))
        }
    }
}

/// 当前快捷键的实际注册状态（用于设置页回显）。
pub fn settings(app: &AppHandle, fallback: &str) -> CaptureSettingsDto {
    app.state::<CaptureShortcutState>().snapshot(fallback)
}
