//! 桌面窗口边界守卫：把窗口状态恢复到当前显示器可容纳的范围内。
//!
//! `tauri-plugin-window-state` 只负责持久化，不知道恢复时显示器是否已经变化。
//! 本模块在启动、缩放、DPI 变化和从托盘唤回时，用 [`window_geometry`] 的纯函数
//! 校正窗口；用户拖动引发的 `Resized` / `Moved` 事件不做完整校正（避免与拖拽
//! 互搏），只在窗口几乎不可见时兜底修复，兜底用 [`window_geometry::best_work_area`]
//! 选一个真实工作区，而不是并集盒。

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Window, WindowEvent};

use super::window_geometry::{
    best_work_area, fit_frame_to_work_area, has_usable_visibility, union_work_area, size_differs,
    BoundsAdjustment, Rect, Size, WindowFrame,
};
use super::MAIN_WINDOW_LABEL;

/// 软性防重入标志。
///
/// 注意：tao 的 `set_size` / `set_position` 是向事件循环投递消息，由此触发的
/// `Resized` / `Moved` 回馈事件在本标志清零之后才会送达，这个标志**拦不住**它们。
/// 校正真正的收敛保障是 `fit_frame_to_work_area` 的幂等性加上 `PIXEL_TOLERANCE`
/// 取整容差；标志只防御同线程内的真正同步重入（例如未来某处在校正过程中直接
/// 再次调用 `normalize`）。
#[derive(Default)]
pub struct WindowBoundsState {
    normalizing: AtomicBool,
}

/// 窗口事件入口（只处理主窗口，其他窗口一律不校正）。
///
/// 事件路由：
/// - `ScaleFactorChanged` 是程序化的 DPI 变化，做完整校正；
/// - `Resized` / `Moved` / `Focused(true)` 合并在同一个兜底分支：用户拖动窗口
///   边缘越界是合法操作，事件回调里立刻 `set_size` 会与拖拽互搏产生抖动，因此
///   只在窗口几乎不可见时修复。三条事件共享一个分支，由编译期保证路由一致，
///   不会悄悄分叉出「某个事件又做完整校正」的例外。
pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }
    let state = window.app_handle().state::<WindowBoundsState>();
    match event {
        WindowEvent::ScaleFactorChanged { .. } => {
            log_adjustment("缩放变化", normalize(window, state.inner()));
        }
        WindowEvent::Resized(_) | WindowEvent::Moved(_) | WindowEvent::Focused(true) => {
            log_adjustment("窗口事件兜底", repair_if_unusable(window, state.inner()));
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
    apply_fit(
        window,
        fit_frame_to_work_area(current_frame(window)?, work_area, min_inner_size(window)),
    )
}

fn repair_if_unusable(window: &Window, state: &WindowBoundsState) -> tauri::Result<bool> {
    if state.normalizing.load(Ordering::Acquire) || should_skip(window)? {
        return Ok(false);
    }

    let areas = monitor_work_areas(window)?;
    let frame = current_frame(window)?;
    if has_usable_visibility(frame.outer, &areas) {
        return Ok(false);
    }
    // 并集包围盒在异尺寸多屏下有「死角」：窗口落在盒内却不与任何显示器相交时，
    // 用并集盒校正会得到空调整、窗口永远找不回。修复必须夹进单个真实工作区。
    let Some(area) = best_work_area(frame.outer, &areas) else {
        return Ok(false);
    };
    apply_fit(
        window,
        fit_frame_to_work_area(frame, area, min_inner_size(window)),
    )
}

/// 当前缩放下窗口允许的最小内尺寸（物理像素），取自 `tauri.conf.json` 的
/// minWidth / minHeight（逻辑像素）× 窗口缩放。系统按它钳制 `set_size`
/// （Windows 走 `WM_GETMINMAXINFO`），目标低于它的请求永远无法生效。
/// 未声明最小尺寸时退回 1×1（不设下限，保持旧行为）。
fn min_inner_size(window: &Window) -> Size {
    let Some(entry) = window
        .app_handle()
        .config()
        .app
        .windows
        .iter()
        .find(|entry| entry.label == MAIN_WINDOW_LABEL)
    else {
        return Size::new(1, 1);
    };
    let (Some(width), Some(height)) = (entry.min_width, entry.min_height) else {
        return Size::new(1, 1);
    };
    let Ok(scale) = window.scale_factor() else {
        return Size::new(1, 1);
    };
    // 向上取整：宁可请求略大于约束，也不能低于会被系统钳回的值。
    Size::new(
        (width * scale).ceil().max(1.0) as u32,
        (height * scale).ceil().max(1.0) as u32,
    )
}

/// 应用一次校正；`Ok(true)` 表示尺寸目标经回读验证真实生效。
///
/// 回读依据：tauri 的窗口调用在主线程同步生效（runtime-wry 在主线程内联执行
/// 消息，tao 再直接走 `SetWindowPos`），`set_size` 返回后 `inner_size` 就是
/// 最终结果。若目标被系统的最小尺寸约束钳回，如实告警而不是谎报校正成功；
/// 位置仍尽力应用（系统不会钳制位置）。
fn apply_fit(window: &Window, adjustment: BoundsAdjustment) -> tauri::Result<bool> {
    if adjustment.is_empty() {
        return Ok(false);
    }
    let mut size_applied = true;
    if let Some(size) = adjustment.size {
        window.set_size(PhysicalSize::new(size.width, size.height))?;
        let actual = window.inner_size()?;
        if size_differs(Size::new(actual.width, actual.height), size) {
            log::warn!(
                target: "ainote::window",
                "窗口尺寸校正未生效：目标 {size:?}，实际 {actual:?}（通常因工作区装不下 minWidth×scale 的最小尺寸约束）"
            );
            size_applied = false;
        }
    }
    if let Some((x, y)) = adjustment.position {
        window.set_position(PhysicalPosition::new(x, y))?;
    }
    Ok(size_applied)
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
