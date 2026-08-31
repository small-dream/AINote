import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";

interface MermaidBlockProps {
  source: string;
  line?: number | undefined;
}

export function MermaidBlock({ source, line }: MermaidBlockProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    void import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base" });
      return mermaid.render(id, source);
    }).then(({ svg }) => {
      if (active && ref.current) ref.current.innerHTML = svg;
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [source]);

  if (error) {
    return <div className="markdown-mermaid markdown-mermaid-error" data-line={line} role="alert">
      <div>{t("note.mermaidRenderFailed")}</div>
      <pre><code>{source}</code></pre>
    </div>;
  }
  return <div ref={ref} className="markdown-mermaid" data-line={line} aria-label="Mermaid diagram" />;
}
