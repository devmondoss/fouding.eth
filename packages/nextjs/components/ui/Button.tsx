"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { T } from "@/lib/motion";

const VARIANT = {
  primary:
    "border border-transparent shadow-[var(--shadow-sm)] hover:brightness-110",
  outline:
    "bg-surface text-hi border border-border hover:border-border-strong hover:bg-surface-soft",
  soft: "bg-surface border hover:bg-surface-soft",
  ghost:
    "text-mid border border-transparent hover:bg-[rgba(16,24,40,0.04)] hover:text-hi",
  danger: "text-white border border-transparent hover:brightness-110",
} as const;

const SIZE = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-10 px-4 text-[13.5px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
} as const;

const BG: Partial<Record<keyof typeof VARIANT, string>> = {
  primary: "var(--brand)",
  danger: "var(--negative)",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  className = "",
  disabled,
  ...rest
}: {
  children?: ReactNode;
  variant?: keyof typeof VARIANT;
  size?: keyof typeof SIZE;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
} & HTMLMotionProps<"button">) {
  const inert = disabled || loading;

  return (
    <motion.button
      {...rest}
      disabled={inert}
      whileHover={inert ? undefined : { y: -1 }}
      whileTap={inert ? undefined : { scale: 0.97 }}
      transition={T.fast}
      style={{
        backgroundColor: BG[variant],
        borderColor: variant === "soft" ? "var(--brand-ink)" : undefined,
        color:
          variant === "primary" || variant === "soft"
            ? "var(--brand-ink)"
            : undefined,
      }}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-[var(--r-input)] font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-ink)]",
        VARIANT[variant],
        SIZE[size],
        className,
      ].join(" ")}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
      {iconRight}
    </motion.button>
  );
}
