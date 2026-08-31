import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY, useUiStore } from "@/stores/ui.store";
import { LanguageSettings } from "./LanguageSettings";

describe("LanguageSettings 语言切换", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ locale: "zh-CN" });
  });

  it("渲染中英文选项并高亮当前语言", () => {
    render(<LanguageSettings />);

    expect(screen.getByRole("radio", { name: "简体中文" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "English" }).getAttribute("aria-checked")).toBe("false");
  });

  it("切换到英文并持久化偏好", () => {
    render(<LanguageSettings />);
    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(useUiStore.getState().locale).toBe("en-US");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en-US");
    expect(screen.getByRole("radiogroup", { name: "Language" })).toBeTruthy();
  });
});
