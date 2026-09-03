import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { FONT_FAMILY_STORAGE_KEY, FONT_SIZE_STORAGE_KEY, useTypographyStore } from "@/stores/typography.store";
import { TypographySettings } from "./TypographySettings";

describe("TypographySettings 排版偏好", () => {
  beforeEach(() => {
    localStorage.clear();
    useTypographyStore.setState({ fontSize: 15, lineHeight: 1.7, readingWidth: 72, fontFamily: "sans" });
  });

  it("渲染字号 / 行高 / 阅读宽度 / 字体族控件", () => {
    render(<TypographySettings />);
    expect(screen.getByLabelText("字号")).toBeTruthy();
    expect(screen.getByLabelText("行高")).toBeTruthy();
    expect(screen.getByLabelText("阅读宽度")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "衬线" })).toBeTruthy();
  });

  it("修改字号与字体族并持久化", () => {
    render(<TypographySettings />);
    fireEvent.change(screen.getByLabelText("字号"), { target: { value: "16" } });
    fireEvent.click(screen.getByRole("radio", { name: "衬线" }));

    expect(useTypographyStore.getState().fontSize).toBe(16);
    expect(useTypographyStore.getState().fontFamily).toBe("serif");
    expect(localStorage.getItem(FONT_SIZE_STORAGE_KEY)).toBe("16");
    expect(localStorage.getItem(FONT_FAMILY_STORAGE_KEY)).toBe("serif");
  });
});
