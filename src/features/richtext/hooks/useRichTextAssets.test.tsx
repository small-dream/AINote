import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useRichTextAssets } from "./useRichTextAssets";

const apiMock = vi.hoisted(() => ({
  onDropPaths: vi.fn(),
  messageOf: vi.fn((error: unknown) => `msg:${String(error)}`),
  assetApi: { importFromPath: vi.fn(), importBytes: vi.fn() },
  syncApi: { commit: vi.fn() },
}));

vi.mock("@/api", () => apiMock);

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function editorMock(dom: HTMLElement) {
  const run = vi.fn();
  const chainMethods = { setImage: vi.fn(() => ({ run })) };
  const editor = {
    chain: vi.fn(() => ({ focus: () => chainMethods })),
    view: { dom },
    isEditable: true,
  } as unknown as Editor;
  return { editor, chainMethods, run };
}

function imageFile(name: string, size = 3): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

function captureDrop() {
  let dropCb: ((paths: string[]) => void) | undefined;
  apiMock.onDropPaths.mockImplementation(async (cb: (paths: string[]) => void) => {
    dropCb = cb;
    return vi.fn();
  });
  return () => dropCb;
}

function mockBytesImport(path: string) {
  apiMock.assetApi.importBytes.mockResolvedValue({ path });
  apiMock.syncApi.commit.mockResolvedValue("hash");
}

function resetMocks() {
  vi.clearAllMocks();
  queryClient.clear();
  apiMock.onDropPaths.mockResolvedValue(vi.fn());
}

function mountAssets(editor: Editor | null) {
  return renderHook(() => useRichTextAssets(editor), { wrapper });
}

describe("useRichTextAssets 导入管线", () => {
  beforeEach(resetMocks);

  it("handleFiles 字节导入成功后在编辑器插入图片", async () => {
    mockBytesImport("assets/pasted.png");
    const { editor, chainMethods, run } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("pasted.png")]);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importBytes).toHaveBeenCalled();
    });

    expect(chainMethods.setImage).toHaveBeenCalledWith({ src: "assets/pasted.png", alt: "pasted.png" });
    expect(run).toHaveBeenCalled();
  });

  it("导入失败时展示真实错误 message（对齐 Markdown 侧）", async () => {
    apiMock.assetApi.importBytes.mockRejectedValue(new Error("disk full"));
    const { editor } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("bad.png")]);
    });
    await vi.waitFor(() => {
      expect(result.current.status).toContain("msg:Error: disk full");
    });
  });

  it("超过 20MB 的图片不进入导入管线并提示", async () => {
    const { editor } = editorMock(document.createElement("div"));

    const { result } = mountAssets(editor);
    await act(async () => {
      result.current.handleFiles([imageFile("big.png", 21 * 1024 * 1024)]);
    });

    expect(apiMock.assetApi.importBytes).not.toHaveBeenCalled();
    expect(result.current.status).toContain("big.png");
  });
});

describe("useRichTextAssets 拖放监听", () => {
  beforeEach(resetMocks);

  it("桌面拖放：仅拖拽悬停在编辑器区域内时才导入", async () => {
    const dom = document.createElement("div");
    document.body.appendChild(dom);
    const { editor, chainMethods } = editorMock(dom);
    const drop = captureDrop();
    apiMock.assetApi.importFromPath.mockResolvedValue({ path: "assets/photo.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    mountAssets(editor);
    await act(async () => {
      await Promise.resolve();
    });

    // 未经过编辑器区域：忽略
    await act(async () => {
      drop()?.(["/Users/jake/photo.png"]);
    });
    expect(apiMock.assetApi.importFromPath).not.toHaveBeenCalled();

    // 悬停进入编辑器区域后再 drop：导入
    await act(async () => {
      dom.dispatchEvent(new Event("dragenter"));
      drop()?.(["/Users/jake/photo.png"]);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importFromPath).toHaveBeenCalledWith("/Users/jake/photo.png");
    });
    expect(chainMethods.setImage).toHaveBeenCalledWith({ src: "assets/photo.png", alt: "photo.png" });
    dom.remove();
  });

  it("无编辑器实例时不注册拖放监听", async () => {
    mountAssets(null);
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiMock.onDropPaths).not.toHaveBeenCalled();
  });
});
