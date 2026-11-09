import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentImport } from "./useDocumentImport";
import { DocumentImportError, type DocumentImportResult } from "../types";

const convertMock = vi.hoisted(() => vi.fn());
const mutateMock = vi.hoisted(() => vi.fn());
const mobileMock = vi.hoisted(() => ({ value: false }));

vi.mock("@/features/document-import/utils/convert", () => ({ convertDocumentFile: convertMock }));
vi.mock("@/queries/note.queries", () => ({ useImportDocumentMutation: () => ({ mutateAsync: mutateMock }) }));
vi.mock("@/platform/runtime", () => ({ isMobileApp: () => mobileMock.value }));
vi.mock("@/api", () => ({ messageOf: (error: unknown) => error instanceof Error ? error.message : String(error) }));

const result: DocumentImportResult = {
  format: "docx",
  sourceName: "报告.docx",
  markdown: "# 报告\n\n正文\n\n![图](ainote-asset://0)",
  assets: [{ fileName: "image-1.png", bytes: new Uint8Array([1, 2, 3]) }],
  warnings: [],
  characters: 20,
};

function file(name = "报告.docx"): File {
  return new File([new Uint8Array([1])], name);
}

describe("useDocumentImport", () => {
  beforeEach(() => {
    convertMock.mockReset();
    mutateMock.mockReset();
    mobileMock.value = false;
  });

  it("解析成功后进入预览状态", async () => {
    convertMock.mockResolvedValue(result);
    const onOpen = vi.fn();
    const { result: hook } = renderHook(() => useDocumentImport(onOpen));
    await act(async () => { await hook.current.start("notes", file()); });
    await waitFor(() => expect(hook.current.state.phase).toBe("ready"));
    expect(hook.current.state.open).toBe(true);
    expect(hook.current.state.result).toEqual(result);
  });

  it("移动端拒绝文档格式", async () => {
    mobileMock.value = true;
    const { result: hook } = renderHook(() => useDocumentImport(vi.fn()));
    await expect(hook.current.start("notes", file())).rejects.toMatchObject({ code: "desktopOnly" });
    expect(convertMock).not.toHaveBeenCalled();
  });

  it("解析失败展示错误码", async () => {
    convertMock.mockRejectedValue(new DocumentImportError("passwordProtected", "locked"));
    const { result: hook } = renderHook(() => useDocumentImport(vi.fn()));
    await act(async () => { await hook.current.start("notes", file("报告.pdf")); });
    await waitFor(() => expect(hook.current.state.phase).toBe("error"));
    expect(hook.current.state.error).toBe("passwordProtected");
  });

  it("解析中取消会复位状态", async () => {
    convertMock.mockImplementation((_file: File, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
    }));
    const { result: hook } = renderHook(() => useDocumentImport(vi.fn()));
    await act(async () => { await hook.current.start("notes", file()); });
    await waitFor(() => expect(hook.current.state.phase).toBe("converting"));
    act(() => hook.current.cancel());
    await waitFor(() => expect(hook.current.state.phase).toBe("idle"));
  });

  it("保存失败保留结果并可重试保存", async () => {
    convertMock.mockResolvedValue(result);
    mutateMock.mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce({ path: "notes/报告.md" });
    const onOpen = vi.fn();
    const { result: hook } = renderHook(() => useDocumentImport(onOpen));
    await act(async () => { await hook.current.start("notes", file()); });
    await waitFor(() => expect(hook.current.state.phase).toBe("ready"));
    await act(async () => { await hook.current.confirm(); });
    expect(hook.current.state.phase).toBe("error");
    expect(hook.current.state.error).toBe("saveFailed");
    expect(hook.current.state.result).toEqual(result);
    await act(async () => { await hook.current.confirm(); });
    await waitFor(() => expect(hook.current.state.phase).toBe("idle"));
    expect(onOpen).toHaveBeenCalledWith("notes/报告.md");
    expect(convertMock).toHaveBeenCalledTimes(1);
  });
});
