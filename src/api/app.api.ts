import { call } from "./client";

/** 使用系统默认程序打开外部 URL（仅允许 http/https）。 */
export async function openExternal(url: string): Promise<void> {
  await call("open_external", { url });
}
