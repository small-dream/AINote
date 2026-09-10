import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const supportApiMock = vi.hoisted(() => ({
  log: vi.fn().mockResolvedValue(undefined),
  exportDiagnostics: vi.fn(),
}));
vi.mock("@/api", () => ({ supportApi: supportApiMock }));

import { ExportDiagnosticsButton } from "./ExportDiagnosticsButton";

describe("ExportDiagnosticsButton", () => {
  beforeEach(() => {
    supportApiMock.exportDiagnostics.mockReset();
  });

  it("导出成功后显示已导出", async () => {
    supportApiMock.exportDiagnostics.mockResolvedValue({
      path: "/tmp/ainote-diagnostics.zip",
      bytes: 128,
      files: ["manifest.json"],
    });
    render(<ExportDiagnosticsButton />);

    fireEvent.click(screen.getByText("导出诊断包"));
    expect(await screen.findByText("已导出")).toBeTruthy();
  });

  it("用户取消时回到初始状态", async () => {
    supportApiMock.exportDiagnostics.mockResolvedValue(null);
    render(<ExportDiagnosticsButton />);

    fireEvent.click(screen.getByText("导出诊断包"));
    expect(await screen.findByText("导出诊断包")).toBeTruthy();
  });

  it("失败时提示导出失败", async () => {
    supportApiMock.exportDiagnostics.mockRejectedValue(new Error("boom"));
    render(<ExportDiagnosticsButton />);

    fireEvent.click(screen.getByText("导出诊断包"));
    expect(await screen.findByText("导出失败")).toBeTruthy();
  });
});
