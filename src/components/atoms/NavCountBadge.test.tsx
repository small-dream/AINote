import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavCountBadge } from "./NavCountBadge";

describe("NavCountBadge", () => {
  it("没有待处理任务时不渲染", () => {
    const { container } = render(<NavCountBadge count={0} tone="danger" />);
    expect(container.firstChild).toBeNull();
  });

  it("显示数量并带上配色", () => {
    render(<NavCountBadge count={3} tone="danger" />);
    const badge = screen.getByText("3");
    expect(badge.className).toContain("bg-danger");
    expect(badge.getAttribute("data-nav-count-badge")).toBe("");
  });

  it("超过 99 收敛成 99+", () => {
    render(<NavCountBadge count={120} tone="warning" />);
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.queryByText("120")).toBeNull();
  });

  it("纯展示：不进无障碍树、不抢点击", () => {
    render(<NavCountBadge count={1} tone="warning" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("1").className).toContain("pointer-events-none");
    expect(screen.getByText("1").getAttribute("aria-hidden")).toBe("true");
  });
});
