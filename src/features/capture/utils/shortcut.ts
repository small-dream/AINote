/** 键盘事件 → Tauri 全局快捷键字符串；无法作为快捷键时返回 null。 */
export function shortcutFromEvent(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key) return null;
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("CommandOrControl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (parts.length === 0 && !/^F([1-9]|1[0-2])$/.test(key)) return null;
  parts.push(key);
  return parts.join("+");
}

function normalizeKey(key: string): string | null {
  if (key === " " || key === "Spacebar") return "Space";
  if (key.length === 1 && /[a-z0-9]/i.test(key)) return key.toUpperCase();
  if (/^F([1-9]|1[0-2])$/i.test(key)) return key.toUpperCase();
  const named: Record<string, string> = {
    Enter: "Enter", Tab: "Tab", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Home: "Home", End: "End",
    PageUp: "PageUp", PageDown: "PageDown", Insert: "Insert", Delete: "Delete",
    Backspace: "Backspace", Comma: "Comma", Period: "Period", Slash: "Slash",
    Minus: "Minus", Equal: "Equal", Backquote: "Backquote",
  };
  return named[key] ?? null;
}

/** 设置页展示：把 CommandOrControl 换成更易读的平台中立写法。 */
export function displayShortcut(shortcut: string): string {
  return shortcut.replace("CommandOrControl", "Ctrl/Cmd").replaceAll("+", " + ");
}
