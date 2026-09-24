import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link2Off } from "lucide-react";
import { useTranslation } from "@/i18n";

const POPOVER_WIDTH = 360;

export interface LinkPopoverRequest {
  /** 点击 / 触摸点的视口坐标，空值表示以工具栏锚点为中心 */
  point?: { x: number; y: number } | undefined;
  /** 已有链接时编辑，否则添加 */
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRemove?: (() => void) | undefined;
  onClose: () => void;
}

interface LinkPopoverProps {
  request: LinkPopoverRequest | null;
  anchorRect?: DOMRect | null | undefined;
}

/** 统一链接浮层：访问、复制、编辑、移除一屏完成；Enter 保存，Esc/外点关闭。 */
export function LinkPopover({ request, anchorRect }: LinkPopoverProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const onClose = request?.onClose;
  useEffect(() => {
    if (!onClose) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [onClose]);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  if (!request) return null;

  const style = { ...popoverPosition(request.point, anchorRect), position: "fixed" as const, zIndex: 60, width: POPOVER_WIDTH };

  return createPortal(
    <div ref={popoverRef} role="dialog" aria-label={t("link.title")} style={style} className="note-theme-surface rounded-xl border border-border bg-bg-primary p-3 shadow-xl">
      <label className="mb-1 block text-xs font-medium text-text-secondary" htmlFor="link-popover-url">{t("link.url")}</label>
      <input id="link-popover-url" ref={inputRef} value={request.value} onChange={(event) => request.onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); request.onSubmit(); } }} placeholder={t("richtext.linkPlaceholder")} aria-label={t("richtext.linkPlaceholder")} aria-invalid={request.invalid} className="h-9 w-full rounded-md border border-border bg-bg-secondary px-2.5 text-sm text-text-primary outline-none focus:border-accent" />
      {request.invalid ? <p role="alert" className="mt-1.5 text-xs text-danger">{t("richtext.linkInvalid")}</p> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        {request.onRemove ? (
          <button type="button" className="mr-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-danger hover:bg-danger/10" onClick={() => { request.onRemove?.(); request.onClose(); }}>
            <Link2Off size={15} aria-hidden /> {t("link.remove")}
          </button>
        ) : null}
        <button type="button" className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary" onClick={request.onClose}>{t("common.cancel")}</button>
        <button type="button" className="rounded-md bg-accent px-3 py-1.5 text-sm text-white shadow-sm hover:brightness-95 active:brightness-90" onClick={request.onSubmit}>{t("common.confirm")}</button>
      </div>
    </div>,
    document.body,
  );
}

function popoverPosition(point?: { x: number; y: number } | undefined, anchorRect?: DOMRect | null): Pick<CSSProperties, "left" | "top"> {
  const x = coordinate(point ? point.x : undefined, anchorRect ? anchorRect.left : undefined, window.innerWidth / 2);
  const y = coordinate(point ? point.y : undefined, anchorRect ? anchorRect.bottom : undefined, 0);
  const topAnchor = coordinate(point ? point.y : undefined, anchorRect ? anchorRect.top : undefined, 0);
  const left = Math.min(Math.max(x, 12), window.innerWidth - POPOVER_WIDTH - 12);
  const below = y + 8;
  const estimate = 150;
  const above = topAnchor - estimate - 8;
  const top = chooseVerticalPosition(below, above, estimate);
  return { left, top };
}

function coordinate(value: number | undefined, fallback: number | undefined, defaultValue: number): number {
  if (value !== undefined) return value;
  if (fallback !== undefined) return fallback;
  return defaultValue;
}

function chooseVerticalPosition(below: number, above: number, height: number): number {
  return below + height > window.innerHeight - 12 && above > 12 ? above : below;
}
