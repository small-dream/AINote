import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NativeDueDateChip, NativeDueTimeChip } from "./NativeDueChips";

function inputOf(container: HTMLElement, kind: "date" | "time"): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`input[type="${kind}"]`);
  if (!input) throw new Error(`未渲染 input[type=${kind}]`);
  return input;
}

describe("移动端原生日期 chip", () => {
  it("未设置截止日期时显示「截止日期」且无清除入口，选中后回调 YYYY-MM-DD", () => {
    const onChange = vi.fn();
    const { container } = render(<NativeDueDateChip value={null} onChange={onChange} />);

    expect(inputOf(container, "date").value).toBe("");
    expect(screen.getByText("截止日期")).toBeDefined();
    expect(screen.queryByRole("button", { name: "清除截止时间" })).toBeNull();

    fireEvent.change(inputOf(container, "date"), { target: { value: "2026-09-20" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-20");
  });

  it("改日期时保留已有的具体时刻", () => {
    const onChange = vi.fn();
    const { container } = render(<NativeDueDateChip value="2026-09-15T18:00" onChange={onChange} />);

    expect(inputOf(container, "date").value).toBe("2026-09-15");
    fireEvent.change(inputOf(container, "date"), { target: { value: "2026-09-20" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-20T18:00");
  });

  it("系统「清除」与 chip 上的 × 都清空截止时间", () => {
    const onChange = vi.fn();
    const { container } = render(<NativeDueDateChip value="2026-09-20" onChange={onChange} />);

    fireEvent.change(inputOf(container, "date"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "清除截止时间" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe("移动端原生时间 chip", () => {
  it("没有截止日期时禁用，避免出现「有时刻无日期」", () => {
    const { container } = render(<NativeDueTimeChip dueAt={null} onChange={vi.fn()} />);

    expect(inputOf(container, "time").disabled).toBe(true);
    expect(inputOf(container, "time").getAttribute("aria-label")).toBe("设置时间");
  });

  it("选中时刻后回调带时刻的截止时间", () => {
    const onChange = vi.fn();
    const { container } = render(<NativeDueTimeChip dueAt="2026-09-20" onChange={onChange} />);

    expect(inputOf(container, "time").value).toBe("");
    fireEvent.change(inputOf(container, "time"), { target: { value: "18:30" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-20T18:30");
  });

  it("清除时刻回到「当天结束前」（只到天）", () => {
    const onChange = vi.fn();
    const { container } = render(<NativeDueTimeChip dueAt="2026-09-20T18:30" onChange={onChange} />);

    fireEvent.change(inputOf(container, "time"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-09-20");

    fireEvent.click(screen.getByRole("button", { name: "清除时间" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-09-20");
  });
});
