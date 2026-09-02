import { call } from "./client";

/** 使用系统默认程序打开外部 URL（仅允许 http/https）。 */
export async function openExternal(url: string): Promise<void> {
  await call("open_external", { url });
}

/** 打开系统打印对话框打印当前页面（导出 PDF 时选择“存储为 PDF”）。 */
export async function printPage(): Promise<void> {
  await call("print_current_page");
}
