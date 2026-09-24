import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows the label immediately on hover without a native title", () => {
    const { getByRole, getByText } = render(
      <Tooltip content="历史">
        <button type="button" aria-label="历史">Open</button>
      </Tooltip>,
    );

    const button = getByRole("button", { name: "历史" });
    const wrapper = button.parentElement;
    if (!wrapper) throw new Error("Tooltip wrapper is missing");
    expect(button.getAttribute("title")).toBeNull();
    expect(getByText("历史").classList.contains("opacity-0")).toBe(true);
    fireEvent.mouseEnter(wrapper);
    expect(getByText("历史").classList.contains("group-hover:opacity-100")).toBe(true);
  });

  it("renders the bubble into document.body when portal is enabled", () => {
    const { getByRole, queryByText } = render(
      <Tooltip content="加粗" placement="bottom" portal>
        <button type="button" aria-label="加粗">B</button>
      </Tooltip>,
    );

    const button = getByRole("button", { name: "加粗" });
    const wrapper = button.parentElement;
    if (!wrapper) throw new Error("Tooltip wrapper is missing");
    // 初始不在触发点 DOM 树内渲染气泡
    expect(queryByText("加粗")).toBeNull();
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();

    fireEvent.mouseEnter(wrapper);

    const bubble = document.body.querySelector('[role="tooltip"]');
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toBe("加粗");
    expect(bubble?.className).toContain("fixed");
  });
});
