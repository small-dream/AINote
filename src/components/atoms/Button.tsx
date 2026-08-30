import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-sm hover:brightness-95 active:brightness-90 disabled:opacity-50",
  ghost: "bg-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary active:bg-bg-tertiary disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    />
  );
}
