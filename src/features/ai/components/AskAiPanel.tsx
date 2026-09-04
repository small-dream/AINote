import type { FormEvent } from "react";
import { Button } from "@/components/atoms/Button";
import { Loader2, MessageSquareText, Send, Trash2, X, CornerDownLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/i18n";
import { useAskAi } from "../hooks/useAskAi";
import { useAiConfig } from "../hooks/useAiConfig";
import { usableAiModels } from "../utils/models";
import { AiModelSelect } from "./AiModelSelect";
import { useUiStore } from "@/stores/ui.store";
import type { AskScope } from "../utils/prompts";

interface AskAiPanelProps {
  open: boolean;
  noteContent: string;
  /** 是否允许把回答插入笔记（富文本 MVP 暂不支持一键插入） */
  canInsert?: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}

/** AI 问答侧栏：基于当前笔记（可选全库检索上下文）提问，回答可插入笔记（P0-AI-4） */
export function AskAiPanel({ open, noteContent, canInsert = true, onClose, onInsert }: AskAiPanelProps) {
  const ai = useAskAi({ noteContent });
  const { data } = useAiConfig();
  const noteTheme = useUiStore((state) => state.noteTheme);
  const configured = usableAiModels(data).length > 0;
  if (!open) return null;
  return (
    <aside data-note-theme={noteTheme} className="note-theme-surface ai-ask-panel flex h-full w-96 shrink-0 flex-col border-l border-border bg-bg-secondary">
      <AskAiHeader onClose={onClose} onReset={ai.reset} />
      <div className="border-b border-border px-3 py-2">
        <AiModelSelect className="w-full" />
      </div>
      <ScopeTabs scope={ai.scope} onChange={ai.setScope} />
      {configured ? null : <AiNotConfigured />}
      <AskAiMessages history={ai.history} streaming={ai.streaming} loading={ai.loading} error={ai.error} canInsert={canInsert} onInsert={onInsert} />
      <AskAiComposer input={ai.input} loading={ai.loading} onChange={ai.setInput} onSend={() => void ai.send()} />
    </aside>
  );
}

function AiNotConfigured() {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-warning/10 px-4 py-2">
      <span className="text-xs text-text-secondary">{t("ai.notConfigured")}</span>
      <Button variant="ghost" className="shrink-0 text-xs" onClick={() => useUiStore.getState().openSettings("ai")}>
        {t("ai.openSettings")}
      </Button>
    </div>
  );
}

function AskAiHeader({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareText size={15} className="text-accent" />
        {t("ai.ask")}
      </h2>
      <div className="flex items-center gap-1">
        <Button variant="ghost" aria-label={t("ai.clear")} title={t("ai.clear")} className="px-2 py-1" onClick={onReset}>
          <Trash2 size={14} />
        </Button>
        <Button variant="ghost" aria-label={t("common.close")} title={t("common.close")} className="px-2 py-1" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}

const SCOPE_OPTIONS: { value: AskScope; labelKey: "ai.askContextCurrent" | "ai.askContextRepo" }[] = [
  { value: "current", labelKey: "ai.askContextCurrent" },
  { value: "repo", labelKey: "ai.askContextRepo" },
];

function ScopeTabs({ scope, onChange }: { scope: AskScope; onChange: (s: AskScope) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 gap-1 border-b border-border p-3">
      {SCOPE_OPTIONS.map(({ value, labelKey }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={scope === value}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${scope === value ? "bg-accent/15 text-accent" : "text-text-secondary hover:bg-bg-tertiary"}`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

function AskAiMessages({ history, streaming, loading, error, canInsert, onInsert }: { history: { role: string; content: string }[]; streaming: string; loading: boolean; error: string | null; canInsert: boolean; onInsert: (text: string) => void }) {
  const { t } = useTranslation();
  const pending = streaming !== "" || loading;
  const items: { role: string; content: string; pending?: boolean }[] = pending
    ? [...history.map((m) => ({ ...m, pending: false })), { role: "assistant", content: streaming, pending: true }]
    : history.map((m) => ({ ...m, pending: false }));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-text-tertiary">{t("ai.emptyAsk")}</p>
      ) : (
        items.map((message, index) => (
          <MessageBubble key={index} message={message} pending={message.pending === true} onInsert={canInsert && message.role === "assistant" && message.pending !== true ? onInsert : undefined} />
        ))
      )}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function MessageBubble({ message, pending, onInsert }: { message: { role: string; content: string; pending?: boolean }; pending?: boolean; onInsert?: ((text: string) => void) | undefined }) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div className={`max-w-full rounded-lg px-3 py-2 text-sm leading-relaxed ${isUser ? "bg-accent/15 text-text-primary" : "border border-border bg-bg-primary"}`}>
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          pending && message.content === "" ? (
            <span className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 size={13} className="animate-spin" />
              {t("ai.generating")}
            </span>
          ) : (
            <div className="prose prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_code]:break-all">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )
        )}
      </div>
      {!isUser && onInsert ? (
        <Button variant="ghost" className="inline-flex items-center gap-1 px-2 py-1 text-xs" onClick={() => onInsert(message.content)}>
          <CornerDownLeft size={13} />
          {t("ai.insertAnswer")}
        </Button>
      ) : null}
    </div>
  );
}

function AskAiComposer({ input, loading, onChange, onSend }: { input: string; loading: boolean; onChange: (v: string) => void; onSend: () => void }) {
  const { t } = useTranslation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSend();
  };
  return (
    <form onSubmit={submit} className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
      <textarea
        value={input}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("ai.askPlaceholder")}
        rows={3}
        className="resize-none rounded-md border border-border bg-bg-primary p-2 text-sm focus:border-accent focus:outline-none"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
      />
      <Button type="submit" disabled={loading || !input.trim()} className="inline-flex items-center justify-center gap-2">
        <Send size={14} />
        {t("ai.askSend")}
      </Button>
    </form>
  );
}
