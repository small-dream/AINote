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
        fit_frame_to_work_area(window, union),
        BoundsAdjustment::default()
    );
    assert_eq!(
        fit_frame_to_work_area(window, areas[1]),
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
        fit_frame_to_work_area(window, areas[0]).position,
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
