import { describe, expect, it } from "vitest";
import { resolveLayerPlacement, type LayerPlacementInput } from "./useAnchoredLayer";

const MENU_WIDTH = 208;
const MENU_HEIGHT = 220;

function input(overrides: Partial<LayerPlacementInput> = {}): LayerPlacementInput {
  return {
    trigger: { left: 400, right: 470, top: 420, bottom: 450 },
    boundary: null,
    viewport: { width: 1280, height: 900 },
    menuWidth: MENU_WIDTH,
    naturalHeight: MENU_HEIGHT,
    align: "start",
    margin: 8,
    ...overrides,
  };
}

describe("resolveLayerPlacement", () => {
  it("视口下方空间充足时向下展开且不限高", () => {
    const placement = resolveLayerPlacement(input());
    expect(placement).toEqual({ position: { left: 400, top: 458 }, maxHeight: null });
  });

  it("视口下方放不下时翻转到锚点上方", () => {
    const placement = resolveLayerPlacement(input({ trigger: { left: 400, right: 470, top: 700, bottom: 730 } }));
    expect(placement.position).toEqual({ left: 400, bottom: 208 });
    expect(placement.maxHeight).toBeNull();
  });

  it("弹窗内下方放不下但上方够高时向上展开，完整显示", () => {
    // 锚点位于视口下半部：下方 250、上方 420，220 的面板放不下时向上
    const placement = resolveLayerPlacement(input({ trigger: { left: 400, right: 470, top: 420, bottom: 450 }, viewport: { width: 1280, height: 700 }, naturalHeight: 380 }));
    expect(placement.position).toEqual({ left: 400, bottom: 288 });
    expect(placement.maxHeight).toBeNull();
  });

  it("上下都放不下时选空间更大的一侧并限高", () => {
    // 上方可用 192、下方可用 142：面板 380 两侧都放不下，选上方并限高到 192
    const placement = resolveLayerPlacement(input({ trigger: { left: 400, right: 470, top: 200, bottom: 230 }, viewport: { width: 1280, height: 380 }, naturalHeight: 380 }));
    expect(placement.position).toEqual({ left: 400, bottom: 188 });
    expect(placement.maxHeight).toBe(192);
  });

  it("可用高度低于下限时保底为最小可操作高度", () => {
    const placement = resolveLayerPlacement(input({ trigger: { left: 400, right: 470, top: 60, bottom: 90 }, viewport: { width: 1280, height: 200 }, naturalHeight: 380 }));
    expect(placement.maxHeight).toBe(132);
  });

  it("菜单超出边界右缘时向内收边", () => {
    const placement = resolveLayerPlacement(input({ trigger: { left: 700, right: 790, top: 420, bottom: 450 }, boundary: { left: 300, right: 800 } }));
    expect(placement.position.left).toBe(584);
  });

  it("align=end 时菜单右缘对齐锚点右缘", () => {
    const placement = resolveLayerPlacement(input({ align: "end" }));
    expect(placement.position.left).toBe(262);
  });

  it("尚未测量高度时不做翻转与限高", () => {
    const placement = resolveLayerPlacement(input({ naturalHeight: 0, boundary: { left: 300, right: 800 } }));
    expect(placement).toEqual({ position: { left: 400, top: 458 }, maxHeight: null });
  });
});
