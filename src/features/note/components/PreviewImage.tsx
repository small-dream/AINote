import { useEffect, useRef, useState, type ImgHTMLAttributes, type Ref, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n";

interface PreviewImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  line?: number | undefined;
}

type ImageState = "loading" | "loaded" | "error";

/** Preview 图片：加载失败时保留提示，点击已加载图片打开可关闭的大图层。 */
export function PreviewImage({ src, alt = "", line, ...props }: PreviewImageProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<ImageState>("loading");
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = alt || src || t("note.image");
  useLightboxLifecycle(open, setOpen, triggerRef);

  return (
    <>
      <ImageFigure
        ref={triggerRef}
        src={src}
        alt={alt}
        label={label}
        line={line}
        state={state}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        onOpen={() => setOpen(true)}
        imageProps={props}
        errorLabel={t("note.imageLoadFailed")}
      />
      {open && src ? <ImageLightbox src={src} alt={alt} label={label} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

interface ImageFigureProps {
  src?: string | undefined;
  alt: string;
  label: string;
  line?: number | undefined;
  state: ImageState;
  onLoad: () => void;
  onError: () => void;
  onOpen: () => void;
  imageProps: ImgHTMLAttributes<HTMLImageElement>;
  errorLabel: string;
}

const ImageFigure = ({ ref, src, alt, label, line, state, onLoad, onError, onOpen, imageProps, errorLabel }: ImageFigureProps & { ref: Ref<HTMLButtonElement> }) => (
  <span className={`markdown-image markdown-image-${state}`} data-line={line} role="group">
    <button ref={ref} type="button" className="markdown-image-trigger" aria-label={label} disabled={state === "error"} onClick={onOpen}>
      <img {...imageProps} src={src} alt={alt} loading="lazy" onLoad={onLoad} onError={onError} />
    </button>
    {state === "error" ? <span className="markdown-image-error" role="status">{errorLabel}</span> : null}
  </span>
);

function useLightboxLifecycle(open: boolean, setOpen: (open: boolean) => void, triggerRef: RefObject<HTMLButtonElement | null>): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);
  useEffect(() => {
    if (open) wasOpen.current = true;
    else if (wasOpen.current) {
      triggerRef.current?.focus();
      wasOpen.current = false;
    }
  }, [open, triggerRef]);
}

function ImageLightbox({ src, alt, label, onClose }: { src: string; alt: string; label: string; onClose: () => void }) {
  const { t } = useTranslation();
  return createPortal(
    <div
      className="markdown-image-lightbox"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="markdown-image-lightbox-content" role="dialog" aria-modal="true" aria-label={label}>
        <button type="button" autoFocus className="markdown-image-lightbox-close" aria-label={t("common.close")} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
        <img src={src} alt={alt} />
      </div>
    </div>,
    document.body,
  );
}
