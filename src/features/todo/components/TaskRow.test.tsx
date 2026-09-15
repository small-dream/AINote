import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItemDto } from "@/api/types";
import { TaskRow } from "./TaskRow";

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
