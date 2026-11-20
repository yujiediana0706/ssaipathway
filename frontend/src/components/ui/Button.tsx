"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover border border-transparent",
  secondary: "bg-white text-foreground border border-border hover:border-brand hover:text-brand",
  ghost: "bg-transparent text-muted-foreground border border-transparent hover:bg-muted hover:text-foreground",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-transparent",
};

const SIZE: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

const BASE =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** 全站统一按钮：高度 ≥40px，图标 16–18px，图标与文字间距 8px */
export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
  }
>(function Button(
  { variant = "primary", size = "md", loading, className = "", children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

/** 纯图标按钮：固定 40×40 可点区域，图标 16–18px */
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: Variant;
  }
>(function IconButton({ label, variant = "ghost", className = "", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`${BASE} ${VARIANT[variant]} h-10 w-10 px-0 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export default Button;
