import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import { insertImage, insertTable } from "../utils/insert";
import { FormatToolbar } from "./FormatToolbar";

const { undo, redo } = vi.hoisted(() => ({ undo: vi.fn(), redo: vi.fn() }));

vi.mock("@codemirror/commands", async () => {
  const actual = await vi.importActual<typeof import("@codemirror/commands")>("@codemirror/commands");
  return { ...actual, undo, redo };
});

vi.mock("../utils/insert", () => ({
  insertCodeBlock: vi.fn(() => ({ changes: [] })),
  insertDivider: vi.fn(() => ({ changes: [] })),
  insertImage: vi.fn(() => ({ changes: [] })),
  insertTable: vi.fn(() => ({ changes: [] })),
  insertLink: vi.fn(() => ({ changes: [] })),
}));

function renderToolbar(overrides: Partial<Parameters<typeof FormatToolbar>[0]> = {}) {
  const view = { state: {}, dispatch: vi.fn(), focus: vi.fn() } as unknown as EditorView;
  const props: Parameters<typeof FormatToolbar>[0] = {
    viewRef: { current: view },
    active: new Set(),
    diagnostics: [],
    diagnosticsOpen: false,
    onDiagnosticsToggle: vi.fn(),
    onDiagnosticsSelect: vi.fn(),
    ...overrides,
  };
  return { view, ...render(<FormatToolbar {...props} />) };
}

describe("FormatToolbar / Markdown history", () => {
  beforeEach(() => {
    undo.mockClear();
    redo.mockClear();
  });

  it("历史为空时禁用撤销和重做", () => {
    renderToolbar();
    expect((screen.getByRole("button", { name: "撤销" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "重做" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("调用当前 CodeMirror view 的撤销和重做命令", () => {
    renderToolbar({ canUndo: true, canRedo: true });
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    fireEvent.click(screen.getByRole("button", { name: "重做" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
  });
});

describe("FormatToolbar / 插入菜单", () => {
  beforeEach(() => {
    vi.mocked(insertTable).mockClear();
    vi.mocked(insertImage).mockClear();
  });

  it("插入类命令收进「插入」菜单，菜单项触发对应命令", () => {
    const { view } = renderToolbar();
    expect(screen.queryByRole("button", { name: "表格" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "插入" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "表格" }));

    expect(insertTable).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("提供 onImagePicked 时图片菜单项唤起文件选择器并回传文件", () => {
    const onImagePicked = vi.fn();
    renderToolbar({ onImagePicked });

    fireEvent.click(screen.getByRole("button", { name: "插入" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    const file = new File(["png"], "a.png", { type: "image/png" });
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    expect(onImagePicked).toHaveBeenCalledWith([file]);
    expect(insertImage).not.toHaveBeenCalled();
  });

  it("未提供 onImagePicked 时图片菜单项退化为占位符命令", () => {
    renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "插入" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "图片" }));

    expect(insertImage).toHaveBeenCalledTimes(1);
  });
});
