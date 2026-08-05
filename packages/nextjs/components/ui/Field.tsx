"use client";

import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  suffix,
  hint,
  error,
  ...rest
}: {
  label: string;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-hi">{label}</span>

      <span
        className="flex items-center gap-2 rounded-[var(--r-input)] border bg-surface px-3 transition-colors focus-within:border-[var(--brand-ink)]"
        style={{ borderColor: error ? "var(--negative)" : "var(--border)" }}
      >
        <input
          {...rest}
          className="num h-10 w-full bg-transparent text-[14px] text-hi outline-none placeholder:font-sans placeholder:text-low"
        />
        {suffix && (
          <span className="shrink-0 text-[12.5px] text-low">{suffix}</span>
        )}
      </span>

      {error ? (
        <span className="text-[12px]" style={{ color: "var(--negative)" }}>
          {error}
        </span>
      ) : (
        hint && <span className="text-[12px] text-low">{hint}</span>
      )}
    </label>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-8 py-12 text-center">
      <span className="h3">{title}</span>
      {detail && <p className="max-w-[400px] text-[13px] text-mid">{detail}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
