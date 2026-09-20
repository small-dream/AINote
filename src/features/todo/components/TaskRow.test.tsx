import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { TaskRow } from "./TaskRow";
import { addLocalDays, localDateString } from "../utils/task";

function task(overrides: Partial<TaskItemDto> = {}): TaskItemDto {
  return {
    id: "t-1",
    title: "写周报",
    description: "",
    done: false,
    priority: "none",
    dueAt: null,
    remindAt: null,
    sortOrder: 0,
    createdAt: "2026-09-15T08:00:00.000Z",
    updatedAt: "2026-09-15T08:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function renderRow(overrides: Partial<TaskItemDto> = {}) {
  render(<TaskRow task={task(overrides)} onToggle={vi.fn()} onOpenEditor={vi.fn()} />);
  return screen.getByRole("checkbox", { name: "写周报" });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TaskRow 完成态复选框", () => {
  it("未完成时是空心圆，不渲染勾", () => {
    const checkbox = renderRow();
    expect(checkbox.querySelector("svg")).toBeNull();
    expect(checkbox.className).toContain("border-text-tertiary");
  });

  it("已完成时才渲染勾并填充强调色", () => {
    const checkbox = renderRow({ done: true });
    expect(checkbox.querySelector("svg")).not.toBeNull();
    expect(checkbox.className).toContain("bg-accent");
  });

  it("点击复选框回调切换完成状态", () => {
    const onToggle = vi.fn();
    render(<TaskRow task={task()} onToggle={onToggle} onOpenEditor={vi.fn()} />);
    screen.getByRole("checkbox", { name: "写周报" }).click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

});

describe("TaskRow 的时间信号", () => {
  const createdAt = new Date(2026, 8, 15, 16, 0).toISOString();

  it("行里只出现截止时间，不再显示创建时间", () => {
    const dueAt = `${localDateString(addLocalDays(new Date(), 1))}T18:00`;
    render(<TaskRow task={task({ createdAt, dueAt })} onToggle={vi.fn()} onOpenEditor={vi.fn()} />);

    // 创建时间戳整个从行里消失（连 title 提示一起）
    expect(screen.queryByTitle(createdAt)).toBeNull();
    expect(screen.queryByText(/9\/15/)).toBeNull();
    // 截止徽标承担行里唯一的时间信号，精确到分钟
    expect(screen.getByText("明天 18:00")).toBeTruthy();
  });

  it("没有截止时间时行里不出现任何时间", () => {
    render(<TaskRow task={task({ createdAt })} onToggle={vi.fn()} onOpenEditor={vi.fn()} />);

    expect(screen.queryByTitle(createdAt)).toBeNull();
    expect(screen.queryByText(/9\/15/)).toBeNull();
  });

  it("跨年截止徽标补上完整年份", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0));
    render(<TaskRow task={task({ dueAt: "2027-01-15" })} onToggle={vi.fn()} onOpenEditor={vi.fn()} />);

    expect(screen.getByText("2027-01-15")).toBeTruthy();
  });
});
