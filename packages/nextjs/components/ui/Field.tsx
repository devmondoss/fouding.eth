"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  suffix,
  hint,
  error,
  compact = false,
  ...rest
}: {
  label: string;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /**
   * Pista y error al final de la línea del rótulo, en vez de debajo del
   * campo. El campo alto —rótulo, caja, mensaje, tres renglones— es el
   * correcto en un formulario, donde la página scrollea; en una barra de
   * acción cuesta 40px de alto que se le restan al documento de abajo, y
   * además hace saltar la barra cada vez que aparece un error. Acá el alto
   * no cambia: el mensaje ocupa el aire que el rótulo deja libre.
   */
  compact?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  const messageId = useId();

  const message = error ? (
    // role="alert" para que un lector de pantalla lo anuncie: antes el
    // error aparecía en silencio.
    <span
      id={messageId}
      role="alert"
      className="text-[12px]"
      style={{ color: "var(--negative)" }}
    >
      {error}
    </span>
  ) : hint ? (
    <span id={messageId} className="text-[12px] text-low">
      {hint}
    </span>
  ) : null;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-[12.5px] font-medium text-hi">
          {label}
        </span>
        {compact && message}
      </span>

      {/* El contorno vive en el envoltorio porque el input lo anula con
          outline-none para no dibujarlo por dentro del borde. Sin esto un
          usuario de teclado no veía en qué campo estaba parado. */}
      <span
        className="flex items-center gap-2 rounded-[var(--r-input)] border bg-surface px-3 transition-colors focus-within:border-[var(--brand-ink)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--brand-ink)] has-[:disabled]:opacity-50"
        style={{ borderColor: error ? "var(--negative)" : "var(--border)" }}
      >
        <input
          {...rest}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className="num h-10 w-full bg-transparent text-[14px] text-hi outline-none placeholder:font-sans placeholder:text-low"
        />
        {suffix && (
          <span className="shrink-0 text-[12.5px] text-low">{suffix}</span>
        )}
      </span>

      {!compact && message}
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
