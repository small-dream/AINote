import { reportFrontendError } from "./error-report";

/** 安装 window 级错误捕获（未捕获异常 / Promise 拒绝），返回清理函数。 */
export function installGlobalErrorLogging(): () => void {
  const onError = (event: ErrorEvent): void => {
    reportFrontendError(event.error ?? event.message, "window.onerror");
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    reportFrontendError(event.reason, "unhandledrejection");
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
