import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import { FormatToolbar } from "./FormatToolbar";

const { undo, redo } = vi.hoisted(() => ({ undo: vi.fn(), redo: vi.fn() }));

vi.mock("@codemirror/commands", async () => {
  const actual = await vi.importActual<typeof import("@codemirror/commands")>("@codemirror/commands");
  return { ...actual, undo, redo };
});

function renderToolbar(overrides: Partial<Parameters<typeof FormatToolbar>[0]> = {}) {
  const view = { focus: vi.fn() } as unknown as EditorView;
  const props: Parameters<typeof FormatToolbar>[0] = {
    viewRef: { current: view },
    active: new Set(),
    diagnostics: [],
    diagnosticsOpen: false,
    onDiagnosticsToggle: vi.fn(),
    onDiagnosticsSelect: vi.fn(),
    ...overrides,
  };
  return render(<FormatToolbar {...props} />);
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
