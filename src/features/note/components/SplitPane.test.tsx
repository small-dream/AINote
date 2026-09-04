import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SplitPane } from "./SplitPane";

vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("SplitPane", () => {
  it("分隔条提供当前比例的 ARIA 值", () => {
    const { getByRole } = render(<SplitPane left={<div />} right={<div />} ratio={0.5} onRatioChange={vi.fn()} />);
    const separator = getByRole("separator");
    expect(separator.getAttribute("aria-valuemin")).toBe("20");
    expect(separator.getAttribute("aria-valuemax")).toBe("80");
    expect(separator.getAttribute("aria-valuenow")).toBe("50");
    expect(separator.getAttribute("tabindex")).toBe("0");
  });

  it("支持方向键与 Home/End 调整比例", () => {
    const onRatioChange = vi.fn();
    const { getByRole } = render(<SplitPane left={<div />} right={<div />} ratio={0.5} onRatioChange={onRatioChange} />);
    const separator = getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    fireEvent.keyDown(separator, { key: "ArrowLeft", shiftKey: true });
    fireEvent.keyDown(separator, { key: "Home" });
    fireEvent.keyDown(separator, { key: "End" });
    expect(onRatioChange.mock.calls.map(([value]) => value)).toEqual([0.52, 0.4, 0.2, 0.8]);
  });
});
