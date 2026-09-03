import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export const AI_INPUT_CLASS =
  "ai-input h-9 w-full rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary transition-colors placeholder:text-text-secondary hover:border-text-tertiary focus:border-accent focus:outline-none";

interface AiFieldProps {
  label: string;
  children: ReactNode;
}

export function AiField({ label, children }: AiFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

export function AiInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${AI_INPUT_CLASS} ${props.className ?? ""}`} />;
}

export function AiSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${AI_INPUT_CLASS} appearance-none ${props.className ?? ""}`} />;
}

interface AiToggleProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function AiToggle({ checked, label, onChange }: AiToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        checked ? "bg-accent" : "bg-bg-tertiary"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-150 ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}
