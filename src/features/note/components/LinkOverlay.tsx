import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ClipboardCopy, ExternalLink, Pencil } from "lucide-react";
import { useTranslation } from "@/i18n";
import { displayableLinkUrl } from "@/platform/links";
import { WIKI_PROTOCOL, decodeWikiHref } from "@/features/wiki/utils/wiki";

const WIDTH = 300;

export interface LinkOverlayRequest {
  point: { x: number; y: number };
  href: string;
  onOpenLink: () => void;
  onCopyLink: () => void;
  onEditLink?: (() => void) | undefined;
  onClose: () => void;
}

/** 移动友好链接浮层：只读动作优先，编辑入口不会遮挡阅读目标。 */
export function LinkOverlay({ request }: { request: LinkOverlayRequest | null }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!request) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) request.onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") request.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("scroll", request.onClose, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("scroll", request.onClose, true);
    };
  }, [request]);

  if (!request) return null;
  const wiki = request.href.startsWith(WIKI_PROTOCOL);
  const target = wiki ? decodeWikiHref(request.href) : displayableLinkUrl(request.href);
  return createPortal(
    <div ref={ref} role="dialog" aria-label={t("link.title")} style={position(request.point)} className="note-theme-surface fixed z-[70] w-[300px] rounded-xl border border-border bg-bg-primary p-3 shadow-xl">
      <p className="truncate text-xs text-text-secondary" title={target}>{target}</p>
      <div className="mt-2 flex items-center gap-1">
        <OverlayButton label={t("link.copy")} icon={ClipboardCopy} onClick={request.onCopyLink} />
        {request.onEditLink ? <OverlayButton label={t("link.edit")} icon={Pencil} onClick={request.onEditLink} /> : null}
        <OverlayButton label={t("link.open")} icon={ExternalLink} onClick={() => { request.onOpenLink(); request.onClose(); }} primary />
      </div>
    </div>,
    document.body,
  );
}

function OverlayButton({ label, icon: Icon, onClick, primary = false }: { label: string; icon: typeof ClipboardCopy; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={primary ? "ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-sm text-white shadow-sm hover:brightness-95" : "inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"}>
      <Icon size={15} aria-hidden />{primary ? label : null}
    </button>
  );
}

function position(point: { x: number; y: number }): CSSProperties {
  const left = Math.min(Math.max(point.x - WIDTH / 2, 12), window.innerWidth - WIDTH - 12);
  const estimated = 78;
  const below = point.y + 8;
  const above = point.y - estimated - 8;
  const top = below + estimated > window.innerHeight - 12 && above > 12 ? above : below;
  return { left, top };
}
