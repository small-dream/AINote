/** E2E 事件总线：模拟 Tauri event 插件的 callback 注册、监听与 emit。 */
type Callback = (message: unknown) => void;

interface CallbackEntry {
  callback: Callback;
  once: boolean;
}

interface EventBridge {
  callbacks?: Map<number, CallbackEntry>;
  listeners?: Map<string, number[]>;
  nextId?: number;
}

const bridge = globalThis as unknown as EventBridge;

function callbacks(): Map<number, CallbackEntry> {
  bridge.callbacks ??= new Map();
  return bridge.callbacks;
}

function listeners(): Map<string, number[]> {
  bridge.listeners ??= new Map();
  return bridge.listeners;
}

export function registerE2eCallback(callback: Callback, once = false): number {
  const id = bridge.nextId ?? 1;
  bridge.nextId = id + 1;
  callbacks().set(id, { callback, once });
  return id;
}

export function unregisterE2eCallback(id: number): void {
  callbacks().delete(id);
}

export function listenE2eEvent(event: string, id: number): number {
  const registered = listeners().get(event) ?? [];
  registered.push(id);
  listeners().set(event, registered);
  return id;
}

export function unlistenE2eEvent(event: string, id: number): void {
  const registered = listeners().get(event) ?? [];
  listeners().set(event, registered.filter((item) => item !== id));
  unregisterE2eCallback(id);
}

export function emitE2eEvent(event: string, payload: unknown): void {
  for (const id of listeners().get(event) ?? []) {
    const entry = callbacks().get(id);
    if (!entry) continue;
    entry.callback({ event, id, payload });
    if (entry.once) unregisterE2eCallback(id);
  }
}
