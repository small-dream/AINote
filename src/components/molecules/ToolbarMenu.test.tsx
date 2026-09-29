import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Bold, Check, Image as ImageIcon, Italic, Palette } from "lucide-react";
import { ToolbarMenu, type ToolbarMenuEntry } from "./ToolbarMenu";

/** 子视图内容：与主题子菜单同构的 menuitemradio 列表 */
function SubView({ onPicked }: { onPicked: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={false} tabIndex={-1} onClick={onPicked}>
      子视图项
    </button>
  );
}

function makeEntries(overrides: { onSelect?: () => void; onPickFiles?: (files: File[]) => void } = {}): ToolbarMenuEntry[] {
  return [
    { key: "first", icon: Bold, label: "第一项", onSelect: overrides.onSelect },
    { key: "blocked", icon: Italic, label: "禁用项", disabled: true },
    { type: "divider" },
    { key: "theme", icon: Palette, label: "主题", submenu: (close) => <SubView onPicked={close} /> },
    { key: "image", icon: ImageIcon, label: "图片", accept: "image/*", onPickFiles: overrides.onPickFiles },
    { key: "radio", icon: Check, label: "二级标题", active: true, role: "menuitemradio", onSelect: overrides.onSelect },
  ];
}

function openMenu(entries: ToolbarMenuEntry[] = makeEntries()) {
  render(<ToolbarMenu icon={Bold} label="更多" entries={entries} />);
  const trigger = screen.getByRole("button", { name: "更多" });
  fireEvent.click(trigger);
  return trigger;
}

/** 键盘事件必须从当前焦点元素冒泡到面板，才能命中 useMenuKeyboardNav */
function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key });
}

const items = () => screen.getAllByRole("menuitem").concat(screen.queryAllByRole("menuitemradio"));
const focused = () => document.activeElement?.textContent?.trim();

describe("ToolbarMenu / 键盘导航", () => {
  it("打开后焦点进入面板并落在首项，跳过禁用项", () => {
    openMenu();
    expect(focused()).toBe("第一项");
  });

  it("方向键在可选项之间循环漫游，Home / End 直达首尾", () => {
    openMenu();
    press("ArrowDown");
    expect(focused()).toBe("主题");
    press("ArrowUp");
    expect(focused()).toBe("第一项");
    press("ArrowUp");
    expect(focused()).toBe("二级标题");
    press("Home");
    expect(focused()).toBe("第一项");
    press("End");
    expect(focused()).toBe("二级标题");
    press("ArrowDown");
    expect(focused()).toBe("第一项");
  });

  it("Escape 关闭菜单并把焦点还给触发按钮", () => {
    const trigger = openMenu();
    press("Escape");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab 关闭菜单并把焦点交回触发按钮，由用户继续 Tab", () => {
    const trigger = openMenu();
    press("Tab");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("子视图内 Escape 先退回主列表并聚焦来源项，而不是关掉整个菜单", () => {
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "主题" }));
    expect(screen.getByRole("menuitemradio", { name: "子视图项" })).toBeTruthy();
    expect(focused()).toBe("主题");

    press("Escape");
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.queryByRole("menuitemradio", { name: "子视图项" })).toBeNull();
    expect(focused()).toBe("主题");
  });
});

describe("ToolbarMenu / 无障碍语义", () => {
  it("文件选择器项是真实按钮，可被键盘聚焦", () => {
    openMenu();
    const image = screen.getByRole("menuitem", { name: "图片" });
    expect(image.tagName).toBe("BUTTON");
    press("End");
    press("ArrowUp");
    expect(document.activeElement).toBe(image);
  });

  it("点击文件选择器项触发隐藏 input 的点击", () => {
    const onPickFiles = vi.fn();
    openMenu(makeEntries({ onPickFiles }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.accept).toBe("image/*");
    const click = vi.fn();
    input?.addEventListener("click", click);

    const image = screen.getByRole("menuitem", { name: "图片" });
    fireEvent.click(image);

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("role=menuitemradio 的项用 aria-checked 表达选中，不再混用 aria-current", () => {
    openMenu();
    const radio = items().find((item) => item.textContent?.includes("二级标题"));
    expect(radio?.getAttribute("role")).toBe("menuitemradio");
    expect(radio?.getAttribute("aria-checked")).toBe("true");
    expect(radio?.getAttribute("aria-current")).toBeNull();
    expect(radio?.getAttribute("tabindex")).toBe("-1");
  });

  it("普通菜单项保持 aria-current 语义", () => {
    openMenu([{ key: "only", icon: Bold, label: "唯一项", active: true, onSelect: vi.fn() }]);
    const item = screen.getByRole("menuitem", { name: "唯一项" });
    expect(item.getAttribute("aria-current")).toBe("true");
    expect(item.getAttribute("aria-checked")).toBeNull();
  });
});
