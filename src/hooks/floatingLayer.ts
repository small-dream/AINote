/**
 * 打开的浮层（下拉菜单、选择器等）计数。
 * 弹窗内的浮层打开时，Esc / 遮罩点击应先收起浮层，而不是连带关掉整个弹窗。
 */
let openFloatingLayers = 0;

export function hasOpenFloatingLayer(): boolean {
  return openFloatingLayers > 0;
}

/** 标记浮层打开，返回注销函数（浮层关闭或卸载时调用）。 */
export function markFloatingLayerOpen(): () => void {
  openFloatingLayers += 1;
  return () => {
    openFloatingLayers = Math.max(0, openFloatingLayers - 1);
  };
}
