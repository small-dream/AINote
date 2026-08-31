import { beforeEach } from "vitest";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key: string) {
      return store.get(String(key)) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  } as Storage;
}

function needsLocalStoragePolyfill(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const probe = "__vitest_ls_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return false;
  } catch {
    return true;
  }
}

if (needsLocalStoragePolyfill()) {
  Object.defineProperty(globalThis, "localStorage", {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
});
