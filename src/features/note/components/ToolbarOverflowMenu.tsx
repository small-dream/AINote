import { ArrowLeftRight, Download, Ellipsis, FolderInput, Printer } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { IconButton } from "@/components/atoms/IconButton";
import { useTranslation } from "@/i18n";
import { useBackHandler } from "@/platform/back-navigation";

interface ToolbarOverflowMenuProps {
  richText: boolean;
  hasConvert: boolean;
  isPdfAvailable: boolean;
  onExportPdf?: (() => void) | undefined;
  onExportMarkdown?: (() => void) | undefined;
  onConvert?: (() => void) | undefined;
  onMove: () => void;
}

interface MenuItem {
  key: string;
  icon: typeof Printer;
  label: string;
  run: () => void;
}

/** 菜单与视口边缘的最小留白，避免贴边或被裁切。 */
const MENU_VIEWPORT_MARGIN = 8;

/** 低频文件操作溢出菜单：把不常用的导出 / 转换 / 移动收进「⋯」，避免常驻顶栏造成噪音。 */
export function ToolbarOverflowMenu({ richText, hasConvert, isPdfAvailable, onExportPdf, onExportMarkdown, onConvert, onMove }: ToolbarOverflowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useCloseOnOutside(rootRef, open, () => setOpen(false));
  useBackHandler(open, () => setOpen(false));

  const items: MenuItem[] = [
    ...(isPdfAvailable && onExportPdf
      ? [{ key: "exportPdf", icon: Printer, label: t("note.exportPdf"), run: onExportPdf }]
      : []),
    ...(onExportMarkdown
      ? [{ key: "exportMarkdown", icon: Download, label: t("richtext.exportMarkdown"), run: onExportMarkdown }]
      : []),
    ...(!richText && hasConvert && onConvert
      ? [{ key: "convert", icon: ArrowLeftRight, label: t("note.convertToRichText"), run: onConvert }]
      : []),
    { key: "move", icon: FolderInput, label: t("note.moving"), run: onMove },
  ];

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        icon={Ellipsis}
        label={t("note.more")}
        active={open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open ? (
        <OverflowMenuPanel items={items} onClose={() => setOpen(false)} anchorRef={rootRef} />
      ) : null}
    </div>
  );
}

function OverflowMenuPanel({ items, onClose, anchorRef }: { items: MenuItem[]; onClose: () => void; anchorRef: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [offsetLeft, setOffsetLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const maxViewportLeft = Math.max(MENU_VIEWPORT_MARGIN, document.documentElement.clientWidth - panel.offsetWidth - MENU_VIEWPORT_MARGIN);
    const viewportLeft = Math.min(Math.max(rect.right - panel.offsetWidth, MENU_VIEWPORT_MARGIN), maxViewportLeft);
    setOffsetLeft(viewportLeft - rect.left);
  }, [anchorRef]);
  return (
    <div ref={panelRef} role="menu" aria-label={t("note.more")} style={offsetLeft === null ? undefined : { left: offsetLeft, right: "auto" }} className="note-overflow-menu absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-lg border border-border bg-bg-primary p-1.5 shadow-sm">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-text-primary transition-colors hover:bg-bg-secondary"
          onClick={() => {
            onClose();
            item.run();
          }}
        >
          <item.icon size={16} />
          <span className="flex-1">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function useCloseOnOutside(ref: RefObject<HTMLDivElement | null>, active: boolean, close: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, close, ref]);
}
