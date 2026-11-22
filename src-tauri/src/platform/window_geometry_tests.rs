use super::*;

/// 未声明最小尺寸约束时的下限（1px），沿用修复前的行为。
const NO_MIN: Size = Size::new(1, 1);

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
        fit_frame_to_work_area(window, work, NO_MIN),
        BoundsAdjustment::default()
    );
}

#[test]
fn shrinks_oversized_window_and_keeps_it_inside_work_area() {
    let work = Rect::new(0, 0, 2992, 1934);
    let window = frame(18, 158, Size::new(4432, 1688), Size::new(4432, 1688));

    let adjustment = fit_frame_to_work_area(window, work, NO_MIN);

    assert_eq!(adjustment.size, Some(Size::new(2992, 1688)));
    assert_eq!(adjustment.position, Some((0, 158)));
}

#[test]
fn accounts_for_outer_versus_inner_chrome() {
    let work = Rect::new(0, 0, 1200, 800);
    let window = frame(0, 0, Size::new(2000, 1000), Size::new(1990, 972));

    let adjustment = fit_frame_to_work_area(window, work, NO_MIN);

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
        fit_frame_to_work_area(window, desktop, NO_MIN),
        BoundsAdjustment::default()
    );
}

#[test]
fn moves_window_back_when_saved_position_is_offscreen() {
    let work = Rect::new(0, 0, 1496, 967);
    let window = frame(-1800, 100, Size::new(1200, 800), Size::new(1200, 772));

    let adjustment = fit_frame_to_work_area(window, work, NO_MIN);

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

#[test]
fn dead_zone_window_repairs_to_nearest_real_monitor() {
    // 上下错位双屏：并集盒在 A 屏下方、B 屏左侧之间留出「死角」。
    let areas = [Rect::new(0, 0, 1920, 1080), Rect::new(500, 1080, 1920, 1080)];
    let window = frame(100, 1500, Size::new(300, 200), Size::new(300, 200));

    assert!(!has_usable_visibility(window.outer, &areas));
    assert_eq!(best_work_area(window.outer, &areas), Some(areas[1]));
    // 并集盒校正得到空调整（旧实现的搁浅路径），夹进真实工作区才找得回窗口。
    let union = union_work_area(&areas).expect("desktop");
    assert_eq!(
        fit_frame_to_work_area(window, union, NO_MIN),
        BoundsAdjustment::default()
    );
    assert_eq!(
        fit_frame_to_work_area(window, areas[1], NO_MIN),
        BoundsAdjustment {
            size: None,
            position: Some((500, 1500)),
        }
    );
}

#[test]
fn diagonal_layout_repairs_to_closer_monitor() {
    // 对角线排列：窗口离 A 屏右缘更近（580px），离 B 屏更远（680px）。
    let areas = [Rect::new(0, 0, 1920, 1080), Rect::new(1920, 1080, 1920, 1080)];
    let window = frame(2500, 200, Size::new(300, 200), Size::new(300, 200));

    assert!(!has_usable_visibility(window.outer, &areas));
    assert_eq!(best_work_area(window.outer, &areas), Some(areas[0]));
    assert_eq!(
        fit_frame_to_work_area(window, areas[0], NO_MIN).position,
        Some((1620, 200))
    );
}

#[test]
fn best_area_prefers_larger_overlap_over_closer_distance() {
    // 窗口压在 A 屏右缘（重叠 100×100），与 B 屏相距 400px：重叠优先。
    let areas = [Rect::new(0, 0, 1000, 1000), Rect::new(1500, 0, 1000, 1000)];
    let window = Rect::new(900, 0, 200, 100);

    assert_eq!(best_work_area(window, &areas), Some(areas[0]));
}

#[test]
fn equidistant_areas_pick_the_first() {
    let areas = [Rect::new(0, 0, 100, 100), Rect::new(140, 0, 100, 100)];
    let window = Rect::new(110, 0, 20, 50);

    assert_eq!(best_work_area(window, &areas), Some(areas[0]));
}

#[test]
fn best_area_skips_invalid_areas() {
    assert_eq!(
        best_work_area(Rect::new(0, 0, 10, 10), &[Rect::new(0, 0, 0, 100)]),
        None
    );
    assert_eq!(
        best_work_area(
            Rect::new(0, 0, 10, 10),
            &[Rect::new(0, 0, 0, 100), Rect::new(5, 5, 10, 10)]
        ),
        Some(Rect::new(5, 5, 10, 10))
    );
}

#[test]
fn oversized_window_never_shrinks_below_min_inner() {
    // 工作区（1024 宽）装不下最小内尺寸 1200：窗口已是 min_inner，不得再请求
    // 更小的尺寸（会被 WM_GETMINMAXINFO 钳回，永不收敛）；位置钉到工作区原点。
    let work = Rect::new(0, 0, 1024, 728);
    let min_inner = Size::new(1200, 600);
    let window = frame(100, 0, Size::new(1216, 616), Size::new(1200, 600));

    let adjustment = fit_frame_to_work_area(window, work, min_inner);

    assert_eq!(adjustment.size, None);
    assert_eq!(adjustment.position, Some((0, 0)));
}

#[test]
fn restored_oversize_shrinks_to_min_inner_when_work_area_too_small() {
    // 插件恢复出 4432 宽的大窗口，而当前工作区装不下 min_inner：
    // 目标抬到 min_inner（高度按工作区收缩到 728），而不是低于约束的死值。
    let work = Rect::new(0, 0, 1024, 728);
    let min_inner = Size::new(1200, 600);
    let window = frame(100, 60, Size::new(4432, 1688), Size::new(4432, 1688));

    let adjustment = fit_frame_to_work_area(window, work, min_inner);

    assert_eq!(adjustment.size, Some(Size::new(1200, 728)));
    assert_eq!(adjustment.position, Some((0, 0)));
}

#[test]
fn grows_window_smaller_than_min_inner() {
    // 异常状态：窗口比声明最小尺寸还小，校正应恢复到 min_inner。
    let work = Rect::new(0, 0, 2992, 1934);
    let min_inner = Size::new(800, 600);
    let window = frame(18, 60, Size::new(300, 200), Size::new(300, 200));

    let adjustment = fit_frame_to_work_area(window, work, min_inner);

    assert_eq!(adjustment.size, Some(min_inner));
    // (18, 60) 对拟合后的 800×600 外框仍合法，位置无需搬动。
    assert_eq!(adjustment.position, None);
}

#[test]
fn no_min_falls_back_to_one_pixel_floor() {
    // 未声明最小尺寸时退回旧行为：目标内尺寸最低 1px。
    let work = Rect::new(0, 0, 8, 6);
    let window = frame(0, 0, Size::new(24, 24), Size::new(8, 8));

    let adjustment = fit_frame_to_work_area(window, work, NO_MIN);

    assert_eq!(adjustment.size, Some(Size::new(1, 1)));
    assert_eq!(adjustment.position, None);
}

#[test]
fn size_differs_respects_pixel_tolerance() {
    // ±1px 属于取整容差（实际生效），超过容差说明目标被系统钳回。
    assert!(!size_differs(Size::new(100, 100), Size::new(101, 99)));
    assert!(size_differs(Size::new(100, 100), Size::new(102, 100)));
    assert!(size_differs(Size::new(100, 100), Size::new(100, 98)));
}
