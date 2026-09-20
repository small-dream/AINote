import { describe, expect, it } from "vitest";
import { taskSaveView } from "./saveState";

describe("taskSaveView", () => {
  it("失败与进行中压过「未保存」，否则用户看不到重试入口", () => {
    expect(taskSaveView(true, "error")).toBe("failed");
    expect(taskSaveView(true, "saving")).toBe("saving");
  });

  it("草稿落后于已落盘内容时不用上一次的「已保存」糊弄过去", () => {
    expect(taskSaveView(true, "saved")).toBe("unsaved");
    expect(taskSaveView(true, "idle")).toBe("unsaved");
  });

  it("状态区常驻：没改动的卡片就是已落盘状态，不做空占位", () => {
    expect(taskSaveView(false, "saved")).toBe("saved");
    expect(taskSaveView(false, "idle")).toBe("saved");
  });
});
