use crate::domain::error::{AppError, AppErrorDto};

#[cfg(desktop)]
use tauri::{AppHandle, Manager};

/// Controller：打开系统打印对话框打印当前 WebView 页面（PDF 导出）。
/// 走 wry WebView 原生打印（macOS 原生打印面板 / Windows window.print / Linux GTK），
/// 前端 `window.print()` 在 macOS WKWebView 上不弹出对话框，因此统一经此命令触发。
#[tauri::command]
#[cfg(desktop)]
pub fn print_current_page(app: AppHandle) -> Result<(), AppErrorDto> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Io("main window not found".into()))?;
    window.print().map_err(|e| AppError::Io(e.to_string()))?;
    Ok(())
}

/// 移动端暂不提供系统打印；调用方可根据结构化错误提示用户导出 Markdown。
#[tauri::command]
#[cfg(mobile)]
pub fn print_current_page() -> Result<(), AppErrorDto> {
    Err(AppError::Io("移动端暂不支持系统打印".into()).into())
}
