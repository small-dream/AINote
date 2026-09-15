import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usesNativeDateTimeInput: vi.fn(() => true),
}));

vi.mock("@/platform/native-datetime", () => ({ usesNativeDateTimeInput: mocks.usesNativeDateTimeInput }));

import { DueDateChip, DueTimeChip } from "./TaskMetaControls";

beforeEach(() => {
  mocks.usesNativeDateTimeInput.mockReset();
});

describe("截止日期 / 时间 chip 的平台分支", () => {
  it("移动壳（WebView 有原生控件）渲染覆盖式系统 input，不开浮层", () => {
    mocks.usesNativeDateTimeInput.mockReturnValue(true);
    const { container } = render(<DueDateChip value={null} onChange={vi.fn()} />);

    expect(mocks.usesNativeDateTimeInput).toHaveBeenCalledWith("date");
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("桌面壳回到自研月历面板入口", () => {
    mocks.usesNativeDateTimeInput.mockReturnValue(false);
    const { container } = render(<DueDateChip value={null} onChange={vi.fn()} />);

    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByRole("button", { name: "设置截止日期" })).toBeDefined();
  });

  it("时间 chip 用同一判定分流", () => {
    mocks.usesNativeDateTimeInput.mockReturnValue(true);
    const { container } = render(<DueTimeChip dueAt="2026-09-20" onChange={vi.fn()} />);

    expect(mocks.usesNativeDateTimeInput).toHaveBeenCalledWith("time");
    expect(container.querySelector('input[type="time"]')).not.toBeNull();
  });
});
