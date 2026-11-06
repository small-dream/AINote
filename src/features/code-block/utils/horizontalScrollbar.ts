export interface HorizontalScrollbarMetrics {
  visible: boolean;
  maxScroll: number;
  thumbWidth: number;
  thumbOffset: number;
}

const MIN_THUMB_WIDTH = 32;

/** 根据滚动容器尺寸计算自定义横向滚动条的轨道与滑块几何。 */
export function horizontalScrollbarMetrics(
  viewportWidth: number,
  contentWidth: number,
  scrollLeft: number,
): HorizontalScrollbarMetrics {
  const viewport = Math.max(0, viewportWidth);
  const content = Math.max(viewport, contentWidth);
  const maxScroll = content - viewport;
  if (maxScroll <= 0) return { visible: false, maxScroll: 0, thumbWidth: viewport, thumbOffset: 0 };

  const proportionalWidth = (viewport * viewport) / content;
  const thumbWidth = Math.min(viewport, Math.max(MIN_THUMB_WIDTH, proportionalWidth));
  const travel = viewport - thumbWidth;
  const progress = clamp(scrollLeft / maxScroll, 0, 1);
  return { visible: true, maxScroll, thumbWidth, thumbOffset: travel * progress };
}

/** 点击轨道时，根据点击位置换算目标 scrollLeft。 */
export function scrollLeftForThumbOffset(
  thumbOffset: number,
  viewportWidth: number,
  contentWidth: number,
): number {
  const metrics = horizontalScrollbarMetrics(viewportWidth, contentWidth, 0);
  const travel = Math.max(0, viewportWidth - metrics.thumbWidth);
  if (!metrics.visible || travel === 0) return 0;
  return (clamp(thumbOffset, 0, travel) / travel) * metrics.maxScroll;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
