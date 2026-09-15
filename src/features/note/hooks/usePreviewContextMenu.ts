import { useCallback, useState, type MouseEvent, type RefObject } from "react";
import { openExternalLink } from "@/platform/open-link";
import { WIKI_PROTOCOL, decodeWikiHref } from "@/features/wiki/utils/wiki";

interface PreviewContextMenuState {
  x: number;
  y: number;
  selection: string;
  href: string | null;
}

interface PreviewContextMenuOptions {
  onOpenWiki?: ((name: string) => void) | undefined;
  previewRef?: RefObject<HTMLElement | null> | undefined;
}

/** 预览是只读渲染层：右键菜单只读取 DOM 状态，不依赖 CodeMirror 选区。 */
export function usePreviewContextMenu({ onOpenWiki, previewRef }: PreviewContextMenuOptions = {}) {
  const [state, setState] = useState<PreviewContextMenuState | null>(null);

  const close = useCallback(() => setState(null), []);

  const open = useCallback((x: number, y: number, target: EventTarget | null) => {
    const link = target instanceof Element ? target.closest("a") : null;
    const href = link?.getAttribute("href") ?? null;
    const selection = selectedText(previewRef?.current ?? null);
    setState({ x, y, selection, href });
  }, [previewRef]);

  const handleContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    open(event.clientX, event.clientY, event.target);
  }, [open]);

  const openAt = useCallback((point: { x: number; y: number }) => {
    const target = document.elementFromPoint(point.x, point.y);
    open(point.x, point.y, target);
  }, [open]);

  const copySelection = useCallback(() => {
    const text = state?.selection;
    if (!text) return;
    close();
    void navigator.clipboard.writeText(text).catch(() => undefined);
  }, [close, state]);

  const copyLink = useCallback(() => {
    const href = state?.href;
    if (!href) return;
    close();
    void navigator.clipboard.writeText(href).catch(() => undefined);
  }, [close, state]);

  const openLink = useCallback(() => {
    const href = state?.href;
    if (!href) return;
    close();
    openHref(href, onOpenWiki);
  }, [close, onOpenWiki, state]);

  const selectAll = useCallback(() => {
    const root = previewRef?.current;
    if (!root) return;
    close();
    const range = document.createRange();
    range.selectNodeContents(root);
    globalThis.getSelection()?.removeAllRanges();
    globalThis.getSelection()?.addRange(range);
  }, [close, previewRef]);

  return { position: state, hasSelection: Boolean(state?.selection), handleContextMenu, openAt, close, copySelection, copyLink, openLink, selectAll };
}

function selectedText(root: HTMLElement | null): string {
  const selection = globalThis.getSelection();
  if (!selection) return "";
  const contained = (node: Node | null) => Boolean(node && (!root || root.contains(node)));
  return contained(selection.anchorNode) && contained(selection.focusNode) ? selection.toString() : "";
}

function openHref(href: string, onOpenWiki: ((name: string) => void) | undefined): void {
  if (href.startsWith(WIKI_PROTOCOL)) {
    onOpenWiki?.(decodeWikiHref(href));
    return;
  }
  if (!/^https?:\/\//i.test(href)) return;
  void openExternalLink(href).catch(() => undefined);
}
