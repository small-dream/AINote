import { useEffect, useRef } from "react";
import { onAndroidBackButton } from "@/api/back-button.api";
import { isAndroidApp } from "./runtime";

export { isAndroidApp };

type BackHandler = () => void;

/** 返回键处理器栈：后注册者优先，用于覆盖层逐层关闭（编辑器 / 对话框 / 面板）。 */
const handlers: BackHandler[] = [];
let unsubscribe: (() => void) | null = null;
let connecting: Promise<void> | null = null;

function dispatchBack(): void {
  handlers[handlers.length - 1]?.();
}

async function connect(): Promise<void> {
  if (unsubscribe || connecting || !isAndroidApp()) return;
  connecting = onAndroidBackButton(dispatchBack)
    .then((off) => {
      if (handlers.length === 0) {
        off();
        return;
      }
      unsubscribe = off;
    })
    .catch(() => undefined)
    .finally(() => {
      connecting = null;
    });
  await connecting;
}

function disconnect(): void {
  const off = unsubscribe;
  unsubscribe = null;
  off?.();
}

function syncListener(): void {
  if (handlers.length > 0) void connect();
  else disconnect();
}

/**
 * 注册系统返回键处理器，返回取消注册函数。
 * 处理器栈为空时监听器会卸载，让系统恢复默认返回（退出应用）。
 */
export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  syncListener();
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
    syncListener();
  };
}

/** React Hook：`active` 为真时把系统返回键接到 `onBack`（仅 Android 生效）。 */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const handlerRef = useRef(onBack);
  useEffect(() => {
    handlerRef.current = onBack;
  }, [onBack]);
  useEffect(() => {
    if (!active) return;
    return registerBackHandler(() => handlerRef.current());
  }, [active]);
}
