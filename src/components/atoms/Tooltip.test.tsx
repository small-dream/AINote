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
});
