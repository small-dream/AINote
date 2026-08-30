import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90",
  ghost: "bg-transparent text-text-primary hover:bg-bg-secondary",
};

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    />
  );
}
