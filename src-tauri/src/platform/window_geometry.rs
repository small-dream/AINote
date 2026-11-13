//! 桌面窗口几何的纯计算：与 Tauri 无关，便于完整单测。
//!
//! 窗口状态由 `tauri-plugin-window-state` 持久化，但插件只按物理像素恢复尺寸，
//! 不知道当前显示器是否发生了变化。这里的规则是：
//! - 以所有显示器 work area 的并集作为可见桌面；
//! - 窗口可以跨屏，但外框不能超出可见桌面；
//! - 尺寸异常时按外框裁到桌面内，并把窗口移回可见区域；
//! - 允许用户主动把窗口部分移出屏幕，只要求保留最小可操作区域。

/// 最小可见宽度：低于该值时窗口视为“找不回来”，需要重新夹紧。
pub const MIN_VISIBLE_WIDTH: u32 = 96;
/// 最小可见高度：低于该值时窗口视为“找不回来”，需要重新夹紧。
pub const MIN_VISIBLE_HEIGHT: u32 = 48;
/// 物理像素取整容差，避免 macOS / Windows 的 1px 舍入造成反复 set_size。
const PIXEL_TOLERANCE: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Size {
    pub width: u32,
    pub height: u32,
}

impl Size {
    pub const fn new(width: u32, height: u32) -> Self {
        Self { width, height }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl Rect {
    pub const fn new(x: i32, y: i32, width: u32, height: u32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowFrame {
    pub outer: Rect,
    pub inner: Size,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct BoundsAdjustment {
    pub size: Option<Size>,
    pub position: Option<(i32, i32)>,
}

impl BoundsAdjustment {
    pub fn is_empty(self) -> bool {
        self.size.is_none() && self.position.is_none()
    }
}

/// 所有显示器 work area 的包围盒。没有有效显示器时返回 `None`。
pub fn union_work_area(areas: &[Rect]) -> Option<Rect> {
    let mut valid = areas
        .iter()
        .filter(|area| area.width > 0 && area.height > 0);
    let first = *valid.next()?;
    let mut left = first.x as i64;
    let mut top = first.y as i64;
    let mut right = left + first.width as i64;
    let mut bottom = top + first.height as i64;

    for area in valid {
        left = left.min(area.x as i64);
        top = top.min(area.y as i64);
        right = right.max(area.x as i64 + area.width as i64);
        bottom = bottom.max(area.y as i64 + area.height as i64);
    }

    Some(Rect::new(
        clamp_i64_to_i32(left),
        clamp_i64_to_i32(top),
        u32::try_from(right - left).unwrap_or(u32::MAX),
        u32::try_from(bottom - top).unwrap_or(u32::MAX),
    ))
}

/// 计算窗口需要执行的校正；完全合法时返回空调整。
pub fn fit_frame_to_work_area(frame: WindowFrame, work_area: Rect) -> BoundsAdjustment {
    if work_area.width == 0 || work_area.height == 0 {
        return BoundsAdjustment::default();
    }

    let chrome_width = frame.outer.width.saturating_sub(frame.inner.width);
    let chrome_height = frame.outer.height.saturating_sub(frame.inner.height);
    let target_outer_width = frame.outer.width.min(work_area.width);
    let target_outer_height = frame.outer.height.min(work_area.height);
    let target_inner = Size::new(
        target_outer_width.saturating_sub(chrome_width).max(1),
        target_outer_height.saturating_sub(chrome_height).max(1),
    );

    let size = if differs(frame.inner.width, target_inner.width)
        || differs(frame.inner.height, target_inner.height)
    {
        Some(target_inner)
    } else {
        None
    };

    let fitted_outer_width = target_inner.width.saturating_add(chrome_width);
    let fitted_outer_height = target_inner.height.saturating_add(chrome_height);
    let target_x = contain_axis(
        frame.outer.x,
        fitted_outer_width,
        work_area.x,
        work_area.width,
    );
    let target_y = contain_axis(
        frame.outer.y,
        fitted_outer_height,
        work_area.y,
        work_area.height,
    );
    let position =
        (frame.outer.x != target_x || frame.outer.y != target_y).then_some((target_x, target_y));

    BoundsAdjustment { size, position }
}

/// 窗口是否在任一显示器上保留了足够大的可操作区域。
pub fn has_usable_visibility(outer: Rect, work_areas: &[Rect]) -> bool {
    if outer.width == 0 || outer.height == 0 {
        return false;
    }

    work_areas.iter().any(|area| {
        let overlap_width = overlap(outer.x, outer.width, area.x, area.width);
        let overlap_height = overlap(outer.y, outer.height, area.y, area.height);
        overlap_width >= MIN_VISIBLE_WIDTH.min(outer.width) as i64
            && overlap_height >= MIN_VISIBLE_HEIGHT.min(outer.height) as i64
    })
}

fn differs(current: u32, target: u32) -> bool {
    current.abs_diff(target) > PIXEL_TOLERANCE
}

fn contain_axis(position: i32, size: u32, start: i32, extent: u32) -> i32 {
    let min = start as i64;
    let max = start as i64 + extent as i64 - size as i64;
    if max < min {
        clamp_i64_to_i32(min)
    } else {
        clamp_i64_to_i32((position as i64).clamp(min, max))
    }
}

fn overlap(a_start: i32, a_size: u32, b_start: i32, b_size: u32) -> i64 {
    let a_end = a_start as i64 + a_size as i64;
    let b_end = b_start as i64 + b_size as i64;
    (a_end.min(b_end) - (a_start as i64).max(b_start as i64)).max(0)
}

fn clamp_i64_to_i32(value: i64) -> i32 {
    value.clamp(i32::MIN as i64, i32::MAX as i64) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame(x: i32, y: i32, outer: Size, inner: Size) -> WindowFrame {
        WindowFrame {
            outer: Rect::new(x, y, outer.width, outer.height),
            inner,
        }
    }

    #[test]
    fn keeps_window_that_already_fits() {
        let work = Rect::new(0, 0, 1496, 967);
        let window = frame(18, 60, Size::new(1200, 800), Size::new(1200, 772));

        assert_eq!(
            fit_frame_to_work_area(window, work),
            BoundsAdjustment::default()
        );
    }

    #[test]
    fn shrinks_oversized_window_and_keeps_it_inside_work_area() {
        let work = Rect::new(0, 0, 2992, 1934);
        let window = frame(18, 158, Size::new(4432, 1688), Size::new(4432, 1688));

        let adjustment = fit_frame_to_work_area(window, work);

        assert_eq!(adjustment.size, Some(Size::new(2992, 1688)));
        assert_eq!(adjustment.position, Some((0, 158)));
    }

    #[test]
    fn accounts_for_outer_versus_inner_chrome() {
        let work = Rect::new(0, 0, 1200, 800);
        let window = frame(0, 0, Size::new(2000, 1000), Size::new(1990, 972));

        let adjustment = fit_frame_to_work_area(window, work);

        assert_eq!(adjustment.size, Some(Size::new(1190, 772)));
        assert_eq!(adjustment.position, None);
    }

    #[test]
    fn keeps_window_spanning_multiple_monitors() {
        let areas = [Rect::new(-1920, 0, 1920, 1080), Rect::new(0, 0, 1496, 967)];
        let desktop = union_work_area(&areas).expect("desktop");
        let window = frame(-1200, 80, Size::new(2000, 800), Size::new(2000, 772));

        assert_eq!(desktop, Rect::new(-1920, 0, 3416, 1080));
        assert_eq!(
            fit_frame_to_work_area(window, desktop),
            BoundsAdjustment::default()
        );
    }

    #[test]
    fn moves_window_back_when_saved_position_is_offscreen() {
        let work = Rect::new(0, 0, 1496, 967);
        let window = frame(-1800, 100, Size::new(1200, 800), Size::new(1200, 772));

        let adjustment = fit_frame_to_work_area(window, work);

        assert_eq!(adjustment.size, None);
        assert_eq!(adjustment.position, Some((0, 100)));
    }

    #[test]
    fn union_uses_negative_monitor_origins() {
        let areas = [Rect::new(0, 0, 1496, 967), Rect::new(-1728, 0, 1728, 1117)];

        assert_eq!(
            union_work_area(&areas),
            Some(Rect::new(-1728, 0, 3224, 1117))
        );
    }

    #[test]
    fn reports_unusable_visibility_after_monitor_removal() {
        let remaining = [Rect::new(0, 0, 1496, 967)];
        let window = Rect::new(-1728, 120, 1799, 800);

        assert!(!has_usable_visibility(window, &remaining));
    }

    #[test]
    fn allows_intentionally_partially_offscreen_window() {
        let remaining = [Rect::new(0, 0, 1496, 967)];
        let window = Rect::new(-300, 120, 1200, 800);

        assert!(has_usable_visibility(window, &remaining));
    }
}
