"use client";

import { useId, type ReactNode } from "react";

/**
 * Elegir de una lista cerrada. Reemplaza al `<select>` nativo y a la fila
 * de botones que cada formulario venía reimplementando a mano (ver el
 * selector de tipo de activo en PublishOpportunityForm).
 *
 * Es un radiogroup de verdad, no una fila de botones: se recorre con
 * flechas, la selección viaja con el teclado y el estado no depende solo
 * del color — la opción elegida rellena su punto y toma borde pleno
 * (docs/design-system.md §Accesibilidad).
 *
 * El punto es un punto, no un check: un radio dice "esta de la lista",
 * mientras que el check afirma "correcto", que es otra cosa. Y el producto
 * no usa iconografía de librería en ningún control (§5.1).
 */

/** Anillo relleno cuando está elegido. La forma cambia, no solo el tono. */
function Dot({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border"
      style={{
        height: size,
        width: size,
        borderColor: on ? "var(--brand-ink)" : "var(--border-strong)",
      }}
    >
      <span
        className="rounded-full"
        style={{
          height: size * 0.45,
          width: size * 0.45,
          backgroundColor: on ? "var(--brand-ink)" : "transparent",
        }}
      />
    </span>
  );
}

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** Segunda línea: para qué sirve esta opción. Opcional. */
  detail?: string;
  /** Cifra o unidad alineada a la derecha. Opcional. */
  meta?: ReactNode;
};

export function ChoiceGroup<T extends string>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  columns = 1,
  footer,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 1 | 2 | 3;
  /** Slot para lo que no cabe en la lista cerrada — típicamente "otro". */
  footer?: ReactNode;
}) {
  const messageId = useId();
  /**
   * `columns` es el techo, no la constante.
   *
   * Tres opciones en 390px de ancho dan columnas de ~110px, y las
   * etiquetas de este producto son frases —"Maquinaria o equipo",
   * "Inmueble comercial"— no palabras sueltas: se partían en cuatro
   * renglones o se salían de la caja. Debajo de `sm` todas las listas
   * bajan a una columna, que en un formulario largo además es más rápido
   * de recorrer con el pulgar; el techo pedido vuelve desde `sm`.
   */
  const cols =
    columns === 3
      ? "grid-cols-1 sm:grid-cols-3"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-hi">{label}</span>

      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={error || hint ? messageId : undefined}
        className={`grid gap-2 ${cols}`}
      >
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.value)}
              className="focusable flex items-start gap-2.5 rounded-[var(--r-input)] border px-3 py-2.5 text-left transition-colors"
              style={{
                borderColor: on ? "var(--brand-ink)" : "var(--border)",
                backgroundColor: on ? "var(--brand-soft)" : "var(--surface)",
              }}
            >
              <span className="mt-[1px]">
                <Dot on={on} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-hi">
                  {option.label}
                </span>
                {option.detail && (
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-mid">
                    {option.detail}
                  </span>
                )}
              </span>

              {option.meta && (
                <span className="num shrink-0 text-[12px] text-mid">
                  {option.meta}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {footer}

      {error ? (
        <span
          id={messageId}
          role="alert"
          className="text-[12px]"
          style={{ color: "var(--negative)" }}
        >
          {error}
        </span>
      ) : (
        hint && (
          <span id={messageId} className="text-[12px] text-low">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

/**
 * Variante compacta para valores cortos (montos, plazos): misma lógica de
 * radiogroup, pero como fichas en línea en vez de filas con descripción.
 */
export function ChipChoice<T extends string>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  footer,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  options: ChoiceOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  footer?: ReactNode;
}) {
  const messageId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-hi">{label}</span>

      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={error || hint ? messageId : undefined}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.value)}
              className="focusable num flex items-center gap-1.5 rounded-[var(--r-pill)] border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
              style={{
                borderColor: on ? "var(--brand-ink)" : "var(--border)",
                backgroundColor: on ? "var(--brand-soft)" : "var(--surface)",
                color: on ? "var(--brand-ink)" : "var(--text-mid)",
              }}
            >
              <Dot on={on} size={11} />
              {option.label}
            </button>
          );
        })}
      </div>

      {footer}

      {error ? (
        <span
          id={messageId}
          role="alert"
          className="text-[12px]"
          style={{ color: "var(--negative)" }}
        >
          {error}
        </span>
      ) : (
        hint && (
          <span id={messageId} className="text-[12px] text-low">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
