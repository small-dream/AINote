import type { Editor } from "@tiptap/core";
import { TEXT_STYLE_SPECS, normalizeTextStyle, type TextStyleKind } from "./textStyles";

/** 当前光标 / 选区是否命中某一档（不传 value 时判定「该组任一带值」）。 */
export function isTextStyleActive(editor: Editor, kind: TextStyleKind, value?: string): boolean {
  const spec = TEXT_STYLE_SPECS[kind];
  if (!editor.isActive(spec.markName)) return false;
  if (value === undefined) return true;
  return editor.isActive(spec.markName, { value });
}

/** 当前生效档位（未设样式时回落到该组默认档），供面板回显。 */
export function activeTextStyle(editor: Editor, kind: TextStyleKind): string | null {
  const spec = TEXT_STYLE_SPECS[kind];
  return spec.values.find((value) => editor.isActive(spec.markName, { value })) ?? spec.defaultValue;
}

/** 应用样式：命中同一档时取消（与加粗等行内格式「高亮即取消」的语义一致）。 */
export function toggleTextStyle(editor: Editor, kind: TextStyleKind, value: string): void {
  const spec = TEXT_STYLE_SPECS[kind];
  const normalized = normalizeTextStyle(kind, value);
  if (!normalized) return;
  if (spec.defaultValue === normalized || editor.isActive(spec.markName, { value: normalized })) {
    editor.chain().focus().unsetMark(spec.markName).run();
    return;
  }
  editor.chain().focus().setMark(spec.markName, { value: normalized }).run();
}

/** 清除该组样式（面板的「重置 / 清除」动作）。 */
export function clearTextStyle(editor: Editor, kind: TextStyleKind): void {
  editor.chain().focus().unsetMark(TEXT_STYLE_SPECS[kind].markName).run();
}
