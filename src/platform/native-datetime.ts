import { isMobileApp } from "./runtime";

/**
 * WebView 原生日期 / 时间控件能力。
 *
 * 移动壳里 `<input type="date">` / `<input type="time">` 由系统渲染成原生选择器：
 * Android 走 Chromium 的 `DateTimeChooserAndroid`（系统 `DatePickerDialog` /
 * `TimePickerDialog`），iOS 走 WebKit 的 `WKDateTimePicker`（`UIDatePicker`）。
 * 取值格式恰好是 `YYYY-MM-DD` / `HH:mm`，与 `dueDay` / `dueTime` 同口径，无需转换。
 *
 * 桌面 macOS 壳的 WKWebView 会「识别 type=date 但没有日期控件」，因此这里只对移动壳
 * 开放；其余环境（含不支持日期类型的 WebView）继续走 `DueDatePanel` / `TimePicker`。
 */
export type NativeDateTimeKind = "date" | "time";

/** 探测用 input 工厂：测试可注入假实现。 */
export type InputFactory = () => HTMLInputElement;

function createInput(): HTMLInputElement {
  return document.createElement("input");
}

/**
 * 纯检测：该环境是否把 `type=date|time` 保留成原生控件。
 * 不支持的实现按规范退化成 `type=text`，此时判定为不可用，回退自研面板。
 */
export function detectNativeInput(kind: NativeDateTimeKind, create: InputFactory): boolean {
  try {
    const probe = create();
    probe.setAttribute("type", kind);
    return probe.type === kind;
  } catch {
    return false;
  }
}

/** 能力判定缓存：同一 WebView 生命周期内结果不变。 */
const supportCache = new Map<NativeDateTimeKind, boolean>();

/** 当前 WebView 是否提供原生日期 / 时间控件（带缓存）。 */
export function supportsNativeInput(kind: NativeDateTimeKind): boolean {
  if (typeof document === "undefined") return false;
  const cached = supportCache.get(kind);
  if (cached !== undefined) return cached;
  const supported = detectNativeInput(kind, createInput);
  supportCache.set(kind, supported);
  return supported;
}

/** 是否用系统选择器：仅移动壳，且该 WebView 确实提供原生控件。 */
export function usesNativeDateTimeInput(kind: NativeDateTimeKind): boolean {
  return isMobileApp() && supportsNativeInput(kind);
}
