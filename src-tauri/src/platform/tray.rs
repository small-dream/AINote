//! 桌面托盘与窗口生命周期（仅桌面端编译）。
//!
//! 行为约定：
//! - 主窗口关闭按钮 = 最小化到托盘：拦下关闭请求并隐藏窗口，进程、编辑器状态与定时器全部保留。
//! - 托盘左键 / 「显示主窗口」把窗口恢复并聚焦；macOS 点击 Dock 图标同样恢复。
//! - 托盘「退出 AINote」才真正退出，退出前仍走 `commands::close_guard` 的待保存变更确认。
//! - 托盘创建失败（个别 Linux 桌面环境没有 StatusNotifier 宿主）时退回旧行为：关闭按钮按
//!   待保存变更确认后关闭窗口退出，避免窗口一旦隐藏就再也回不到前台。
//! 移动端没有窗口关闭事件与托盘，不受此机制影响。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Window};

use crate::commands::close_guard;

/// 主窗口 label（`tauri.conf.json` 未声明 label，Tauri 默认使用 "main"）。
const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ID: &str = "ainote-tray";
const MENU_SHOW_ID: &str = "ainote-tray-show";
const MENU_QUIT_ID: &str = "ainote-tray-quit";

/// 托盘可用性：`setup` 成功创建托盘后置位；创建失败时关闭按钮退回旧的关闭语义。
#[derive(Default)]
pub struct TrayState(AtomicBool);

impl TrayState {
    /// 标记托盘已可用（`setup` 成功后调用一次）。
    pub fn mark_ready(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    /// 托盘是否可用；不可用时关闭按钮不做「隐藏到托盘」。
    pub fn is_ready(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }
}

/// 托盘菜单动作。
#[derive(Debug, PartialEq, Eq)]
pub enum TrayAction {
    Show,
    Quit,
}

impl TrayAction {
    /// 菜单 id → 动作（纯逻辑）。未知 id 返回 None（菜单事件是全应用共享的）。
    pub fn from_menu_id(id: &str) -> Option<Self> {
        match id {
            MENU_SHOW_ID => Some(TrayAction::Show),
            MENU_QUIT_ID => Some(TrayAction::Quit),
            _ => None,
        }
    }
}

/// 创建托盘图标与菜单（应用启动时调用一次）。
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, MENU_SHOW_ID, "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT_ID, "退出 AINote", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("AINote")
        // 左键恢复窗口、右键出菜单（桌面习惯）；Linux 不支持该开关。
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match TrayAction::from_menu_id(event.id().as_ref()) {
            Some(TrayAction::Show) => reveal_main_window(app),
            // 退出仍由事件循环的 ExitRequested 守卫统一裁决（见 handle_exit_requested）。
            Some(TrayAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                reveal_main_window(tray.app_handle());
            }
        });
    // 复用应用图标（桌面端默认窗口图标即 icons/32x32.png），不额外引入图片解码依赖。
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    app.state::<TrayState>().mark_ready();
    log::info!(target: "ainote::tray", "托盘图标已就绪：关闭按钮将把窗口收进托盘");
    Ok(())
}

/// 关闭按钮：托盘可用时隐藏窗口到托盘，托盘不可用时退回旧的关闭语义。
pub fn handle_close_requested(window: &Window, api: &tauri::CloseRequestApi) {
    let app = window.app_handle();
    if app.state::<TrayState>().is_ready() {
        // 隐藏到托盘不退出也不丢数据，因此不必探测待保存变更（每点一次都跑 git status 会卡主线程）。
        api.prevent_close();
        match window.hide() {
            Ok(()) => log::info!(target: "ainote::tray", "主窗口已收进托盘，应用继续在后台运行"),
            Err(error) => log::warn!(target: "ainote::tray", "隐藏到托盘失败: {error}"),
        }
        return;
    }
    api.prevent_close();
    if close_guard::should_intercept(false, close_guard::has_pending_changes(app)) {
        let _ = app.emit("app:close-requested", ());
    } else {
        app.exit(0);
    }
}

/// 应用即将退出：有待保存变更时拦下退出，把窗口叫回前台交给前端确认。
pub fn handle_exit_requested(app: &AppHandle, api: &tauri::ExitRequestApi, code: Option<i32>) {
    // 更新安装后的重启（plugin-process relaunch）由系统接管，不做用户确认。
    if code == Some(tauri::RESTART_EXIT_CODE) {
        return;
    }
    let allowed = app.state::<close_guard::CloseGuard>().take_allow();
    if !close_guard::should_intercept(allowed, close_guard::has_pending_changes(app)) {
        return;
    }
    api.prevent_exit();
    reveal_main_window(app);
    let _ = app.emit("app:close-requested", ());
}

/// 事件循环回调：退出请求守卫 + macOS 点击 Dock 图标唤醒窗口。
pub fn handle_run_event(app: &AppHandle, event: &tauri::RunEvent) {
    match event {
        tauri::RunEvent::ExitRequested { api, code, .. } => handle_exit_requested(app, api, *code),
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => reveal_main_window(app),
        _ => {}
    }
}

/// 把主窗口从托盘恢复：显示、取消最小化并聚焦。
pub fn reveal_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let revealed = window
        .show()
        .and_then(|_| window.unminimize())
        .and_then(|_| window.set_focus());
    match revealed {
        Ok(()) => log::info!(target: "ainote::tray", "已从托盘恢复主窗口"),
        Err(error) => log::warn!(target: "ainote::tray", "恢复主窗口失败: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_menu_ids_only() {
        assert_eq!(TrayAction::from_menu_id(MENU_SHOW_ID), Some(TrayAction::Show));
        assert_eq!(TrayAction::from_menu_id(MENU_QUIT_ID), Some(TrayAction::Quit));
        assert_eq!(TrayAction::from_menu_id("close-window"), None);
        assert_eq!(TrayAction::from_menu_id(""), None);
    }

    #[test]
    fn tray_state_defaults_to_unavailable() {
        let state = TrayState::default();
        assert!(!state.is_ready(), "未创建托盘前关闭按钮不得隐藏窗口");
        state.mark_ready();
        assert!(state.is_ready());
    }
}
