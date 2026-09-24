import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";
import { LinkOverlay } from "./LinkOverlay";

const base = {
  onOpenLink: vi.fn(),
  onCopyLink: vi.fn(),
  onEditLink: vi.fn(),
  onClose: vi.fn(),
};

describe("LinkOverlay", () => {
  it("renders mobile friendly actions from a request object", () => {
    render(<LinkOverlay request={{ ...base, point: { x: 100, y: 100 }, href: "https://example.com/path" }} />);
    expect(screen.getByText("example.com/path")).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "访问" })).toBeTruthy();
  });
});
