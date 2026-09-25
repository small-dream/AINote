import { useCallback, useState } from "react";
import type { EditorView } from "@codemirror/view";
import type { LinkPopoverRequest } from "@/components/molecules/LinkPopover";
import { normalizeLinkInput } from "@/platform/links";
import { dispatchFormat } from "./useFormatCommands";
import { findMarkdownLink, insertLink, removeMarkdownLink, replaceMarkdownLinkUrl, type MarkdownLinkTarget } from "../utils/insert";

interface LinkInputState {
  point: { x: number; y: number };
  value: string;
  target: MarkdownLinkTarget | null;
}

export function useMarkdownLinkInput(viewRef: React.RefObject<EditorView | null>) {
  const [state, setState] = useState<LinkInputState | null>(null);

  const close = useCallback(() => setState(null), []);
  const open = useCallback((point?: { x: number; y: number }) => {
    const view = viewRef.current;
    if (!view) return;
    const rect = view.dom.getBoundingClientRect();
    const fallback = { x: rect.left + rect.width / 2, y: rect.top + 24 };
    const target = findMarkdownLink(view.state);
    setState({ point: point ?? fallback, value: target?.href ?? "", target });
  }, [viewRef]);
  const openForHref = useCallback((href: string, point: { x: number; y: number }) => {
    const view = viewRef.current;
    if (!view) return;
    setState({ point, value: href, target: findMarkdownLink(view.state) });
  }, [viewRef]);
  const remove = useCallback(() => {
    const view = viewRef.current;
    if (!view || !state?.target) return;
    dispatchFormat(view, (current) => removeMarkdownLink(current, state.target as MarkdownLinkTarget));
    view.focus();
    close();
  }, [close, state, viewRef]);
  const submit = useCallback(() => {
    const view = viewRef.current;
    if (!view || !state) return;
    if (!state.value.trim()) {
      if (state.target) remove();
      else close();
      return;
    }
    const href = normalizeLinkInput(state.value);
    if (!href) return;
    dispatchFormat(view, (current) => state.target ? replaceMarkdownLinkUrl(state.target as MarkdownLinkTarget, href) : insertLink(current, href));
    view.focus();
    close();
  }, [close, remove, state, viewRef]);
  const request: LinkPopoverRequest | null = state ? {
    point: state.point,
    value: state.value,
    invalid: Boolean(state.value.trim()) && normalizeLinkInput(state.value) === null,
    onChange: (value) => setState((current) => current ? { ...current, value } : current),
    onSubmit: submit,
    ...(state.target ? { onRemove: remove } : {}),
    onClose: close,
  } : null;
  return { request, open, openForHref };
}
