//! 桌面窗口几何的纯计算：与 Tauri 无关，便于完整单测。
//!
//! 窗口状态由 `tauri-plugin-window-state` 持久化，但插件只按物理像素恢复尺寸，
//! 不知道当前显示器是否发生了变化。这里的规则是：
//! - 以所有显示器 work area 的并集作为可见桌面；
//! - 窗口可以跨屏，但外框不能超出可见桌面；
//! - 尺寸异常时按外框裁到桌面内，并把窗口移回可见区域；
//! - 允许用户主动把窗口部分移出屏幕，只要求保留最小可操作区域；
//! - 找回几乎不可见的窗口时用 [`best_work_area`] 选一个真实工作区：异尺寸多屏
//!   布局的并集盒内存在「死角」，落在死角里的窗口用并集盒校正会得到空调整；
//! - 目标内尺寸不低于窗口最小尺寸约束（minWidth × 缩放）：工作区装不下最小
//!   尺寸时，宁可让窗口超出工作区，也不请求一个会被系统钳回、永不收敛的尺寸。

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
///
/// `min_inner` 是窗口在当前缩放下允许的最小内尺寸（物理像素）。系统会按它
/// 钳制 `set_size`（Windows 走 `WM_GETMINMAXINFO`），目标低于它时请求永远
/// 无法生效：校正不收敛，还可能反复空转。因此工作区装不下最小尺寸时，目标
/// 被抬到 `min_inner`，窗口宁可超出工作区。
pub fn fit_frame_to_work_area(
    frame: WindowFrame,
    work_area: Rect,
    min_inner: Size,
) -> BoundsAdjustment {
    if work_area.width == 0 || work_area.height == 0 {
        return BoundsAdjustment::default();
    }

    let chrome_width = frame.outer.width.saturating_sub(frame.inner.width);
    let chrome_height = frame.outer.height.saturating_sub(frame.inner.height);
    let target_outer_width = frame.outer.width.min(work_area.width);
    let target_outer_height = frame.outer.height.min(work_area.height);
    let target_inner = Size::new(
        target_outer_width
            .saturating_sub(chrome_width)
            .max(min_inner.width)
            .max(1),
        target_outer_height
            .saturating_sub(chrome_height)
            .max(min_inner.height)
            .max(1),
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

/// 找回不可见窗口时选定的目标工作区：与窗口外框重叠面积最大者；
/// 没有任何重叠时取边界距离最近者（切比雪夫距离）；完全并列取列表靠前者。
pub fn best_work_area(outer: Rect, work_areas: &[Rect]) -> Option<Rect> {
    let mut best: Option<(i64, i64, Rect)> = None;
    for &area in work_areas {
        if area.width == 0 || area.height == 0 {
            continue;
        }
        let candidate = (overlap_area(outer, area), rect_distance(outer, area));
        let better = match best {
            Some((overlap, distance, _)) => {
                candidate.0 > overlap || (candidate.0 == overlap && candidate.1 < distance)
            }
            None => true,
        };
        if better {
            best = Some((candidate.0, candidate.1, area));
        }
    }
    best.map(|(_, _, area)| area)
}

fn overlap_area(a: Rect, b: Rect) -> i64 {
    overlap(a.x, a.width, b.x, b.width) * overlap(a.y, a.height, b.y, b.height)
}

/// 两个矩形的切比雪夫距离：相交或相邻时为 0。
fn rect_distance(a: Rect, b: Rect) -> i64 {
    gap_axis(a.x, a.width, b.x, b.width).max(gap_axis(a.y, a.height, b.y, b.height))
}

fn gap_axis(a_start: i32, a_size: u32, b_start: i32, b_size: u32) -> i64 {
    let a_end = a_start as i64 + a_size as i64;
    let b_end = b_start as i64 + b_size as i64;
    (a_start as i64 - b_end).max(b_start as i64 - a_end).max(0)
}

fn differs(current: u32, target: u32) -> bool {
    current.abs_diff(target) > PIXEL_TOLERANCE
}

/// 实际内尺寸与目标是否相差超过取整容差：供壳层在 `set_size` 后回读验证，
/// 目标被系统钳回时据此如实告警，而不是谎报校正成功。
pub fn size_differs(actual: Size, target: Size) -> bool {
    differs(actual.width, target.width) || differs(actual.height, target.height)
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
#[path = "window_geometry_tests.rs"]
mod tests;
