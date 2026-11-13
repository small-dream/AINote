//! 桌面窗口边界守卫：把窗口状态恢复到当前显示器可容纳的范围内。
//!
//! `tauri-plugin-window-state` 只负责持久化，不知道恢复时显示器是否已经变化。
//! 本模块在启动、缩放、跨屏、DPI 变化和从托盘唤回时，用 [`window_geometry`]
//! 的纯函数校正窗口；正常尺寸与位置不会被反复改写。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Window, WindowEvent};

use super::window_geometry::{
    fit_frame_to_work_area, has_usable_visibility, union_work_area, Rect, Size, WindowFrame,
};
use super::MAIN_WINDOW_LABEL;

/// 防止 `set_size` / `set_position` 触发的事件再次进入校正逻辑。
#[derive(Default)]
pub struct WindowBoundsState {
    normalizing: AtomicBool,
}

/// 窗口事件入口：尺寸变化总是校验；移动/聚焦只在窗口几乎不可见时兜底。
pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    let state = window.app_handle().state::<WindowBoundsState>();
    match event {
        WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } => {
            log_adjustment("窗口尺寸变化", normalize(window, state.inner()));
        }
        WindowEvent::Moved(_) | WindowEvent::Focused(true) => {
            log_adjustment("窗口跨屏/聚焦", repair_if_unusable(window, state.inner()));
        }
        _ => {}
    }
}

/// 启动与托盘唤回时调用：不做“是否仍可见”的妥协，直接保证外框在桌面内。
pub fn ensure_main_window_in_bounds(app: &AppHandle) {
    let Some(webview) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };
    let window = webview.as_ref().window();
    let state = app.state::<WindowBoundsState>();
    log_adjustment("启动/唤回", normalize(&window, state.inner()));
}

fn log_adjustment(reason: &str, result: tauri::Result<bool>) {
    match result {
        Ok(true) => log::info!(
            target: "ainote::window",
            "已按当前显示器工作区校正窗口几何（{reason}）"
        ),
        Ok(false) => {}
        Err(error) => {
            log::debug!(target: "ainote::window", "窗口几何校正失败（{reason}）: {error}")
        }
    }
}

fn normalize(window: &Window, state: &WindowBoundsState) -> tauri::Result<bool> {
    if state.normalizing.swap(true, Ordering::AcqRel) {
        return Ok(false);
    }

    let result = normalize_inner(window);
    state.normalizing.store(false, Ordering::Release);
    result
}

fn normalize_inner(window: &Window) -> tauri::Result<bool> {
    if should_skip(window)? {
        return Ok(false);
    }

    let Some(work_area) = union_work_area(&monitor_work_areas(window)?) else {
        return Ok(false);
    };
    let adjustment = fit_frame_to_work_area(current_frame(window)?, work_area);
    if adjustment.is_empty() {
        return Ok(false);
    }

    if let Some(size) = adjustment.size {
        window.set_size(PhysicalSize::new(size.width, size.height))?;
    }
    if let Some((x, y)) = adjustment.position {
        window.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(true)
}

fn repair_if_unusable(window: &Window, state: &WindowBoundsState) -> tauri::Result<bool> {
    if state.normalizing.load(Ordering::Acquire) || should_skip(window)? {
        return Ok(false);
    }

    let areas = monitor_work_areas(window)?;
    let outer = current_frame(window)?.outer;
    if has_usable_visibility(outer, &areas) {
        return Ok(false);
    }
    normalize(window, state)
}

fn should_skip(window: &Window) -> tauri::Result<bool> {
    Ok(window.is_minimized()? || window.is_maximized()? || window.is_fullscreen()?)
}

fn current_frame(window: &Window) -> tauri::Result<WindowFrame> {
    let position = window.outer_position()?;
    let outer = window.outer_size()?;
    let inner = window.inner_size()?;
    Ok(WindowFrame {
        outer: Rect::new(position.x, position.y, outer.width, outer.height),
        inner: Size::new(inner.width, inner.height),
    })
}

fn monitor_work_areas(window: &Window) -> tauri::Result<Vec<Rect>> {
    Ok(window
        .available_monitors()?
        .into_iter()
        .filter_map(|monitor| {
            let area = monitor.work_area();
            (area.size.width > 0 && area.size.height > 0).then_some(Rect::new(
                area.position.x,
                area.position.y,
                area.size.width,
                area.size.height,
            ))
        })
        .collect())
}
