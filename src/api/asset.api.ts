import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { call } from "./client";
import type { AssetInfo } from "./types";

/** 资产导入 IPC（P1-4）：存入仓库 assets/ 并返回仓库相对路径 */
export const assetApi = {
  /** 从本地路径导入（拖放文件） */
  importFromPath: (sourcePath: string) => call<AssetInfo>("import_asset", { sourcePath }),
  /** 从内存字节导入（粘贴图片） */
  importBytes: (bytes: Uint8Array, fileName: string) =>
    call<AssetInfo>("import_asset_bytes", { bytes, fileName }),
  /** 批量检查仓库相对路径是否指向存在的文件（Markdown 图片断链诊断） */
  exists: (paths: string[]) => call<boolean[]>("asset_exists", { paths }),
};

/** 注册桌面端文件拖放监听，返回取消函数；drop 后回调本地文件路径列表 */
export async function onDropPaths(callback: (paths: string[]) => void): Promise<() => void> {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") callback(event.payload.paths);
  });
}

/** 把本地绝对路径转换为 webview 可访问的资产 URL（预览渲染图片） */
export function assetUrl(absPath: string): string {
  return convertFileSrc(absPath);
}
