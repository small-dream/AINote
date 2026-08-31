import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { EditorView } from "@codemirror/view";
import { dispatchFormat } from "@/features/note/hooks/useFormatCommands";
import { useAssetImport } from "./useAssetImport";

const apiMock = vi.hoisted(() => ({
  onDropPaths: vi.fn(),
  messageOf: vi.fn((error: unknown) => String(error)),
  assetApi: { importFromPath: vi.fn(), importBytes: vi.fn() },
  syncApi: { commit: vi.fn() },
}));

vi.mock("@/api", () => apiMock);
vi.mock("@/features/note/hooks/useFormatCommands", () => ({
  dispatchFormat: vi.fn(),
}));

const dispatchFormatMock = vi.mocked(dispatchFormat);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function fakeState(from = 0, to = 0) {
  return { selection: { main: { from, to } } } as never;
}

function viewMock() {
  return { focus: vi.fn() } as unknown as EditorView;
}

function insertResult(name: string, path: string) {
  const fn = dispatchFormatMock.mock.calls[0]?.[1];
  const result = fn?.(fakeState());
  expect(result?.changes).toEqual({ from: 0, to: 0, insert: `![${name}](${path})` });
}

async function mount(view: EditorView | null) {
  const { result } = renderHook(() => useAssetImport(view), { wrapper });
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

function captureDrop() {
  let dropCb: ((paths: string[]) => void) | undefined;
  apiMock.onDropPaths.mockImplementation(async (cb: (paths: string[]) => void) => {
    dropCb = cb;
    return vi.fn();
  });
  return () => dropCb;
}

describe("useAssetImport 拖放导入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("注册拖放监听并在导入成功后于光标处插入引用", async () => {
    const view = viewMock();
    const drop = captureDrop();
    apiMock.assetApi.importFromPath.mockResolvedValue({ path: "assets/photo.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    await mount(view);
    await act(async () => {
      drop()?.(["/Users/jake/photo.png"]);
    });
    await vi.waitFor(() => {
      expect(apiMock.syncApi.commit).toHaveBeenCalledWith("note: asset assets/photo.png");
    });

    expect(apiMock.assetApi.importFromPath).toHaveBeenCalledWith("/Users/jake/photo.png");
    insertResult("photo.png", "assets/photo.png");
    expect(view.focus).toHaveBeenCalled();
  });
});

describe("useAssetImport 文件选择器与边界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("工具栏文件选择器走字节导入并插入引用", async () => {
    const view = viewMock();
    apiMock.assetApi.importBytes.mockResolvedValue({ path: "assets/pasted.png" });
    apiMock.syncApi.commit.mockResolvedValue("hash");

    const result = await mount(view);
    const file = new File([new Uint8Array([1, 2, 3])], "pasted.png");
    await act(async () => {
      result.current.handleFiles([file]);
    });
    await vi.waitFor(() => {
      expect(apiMock.assetApi.importBytes).toHaveBeenCalledWith(
        new Uint8Array([1, 2, 3]),
        "pasted.png"
      );
    });

    insertResult("pasted.png", "assets/pasted.png");
  });

  it("无编辑器视图时不注册拖放监听", async () => {
    await mount(null);
    expect(apiMock.onDropPaths).not.toHaveBeenCalled();
  });
});
