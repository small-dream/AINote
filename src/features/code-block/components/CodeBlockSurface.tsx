import { useState, type ComponentProps } from "react";
import { CodeBlockControls } from "./CodeBlockControls";

interface Props extends ComponentProps<"pre"> {
  source?: string | undefined;
  language?: string | null | undefined;
  line?: number | undefined;
}

export function CodeBlockSurface({ children, source, language, line, className, ...props }: Props) {
  const [pre, setPre] = useState<HTMLPreElement | null>(null);
  const [scrollHost, setScrollHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="note-code-block markdown-code-block" data-line={line}>
      <div className="note-code-main">
        <div className="note-code-content markdown-code-scroller">
          <pre {...props} ref={setPre} className={"note-code-pre markdown-code-pre " + (className ?? "")}>{children}</pre>
          <div ref={setScrollHost} className="note-code-scroll-host" data-code-control="" />
        </div>
        <div className="note-code-controls" data-code-control="">
          {pre && scrollHost ? <CodeBlockControls pre={pre} scrollHost={scrollHost}
            getSource={() => source ?? pre.textContent ?? ""} /> : null}
        </div>
      </div>
      {language ? <div className="note-code-language">{language}</div> : null}
    </div>
  );
}
