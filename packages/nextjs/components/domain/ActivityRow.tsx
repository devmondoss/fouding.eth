import { formatDate, formatUsdc } from "@/lib/format";
import type { ActivityEvent } from "@/lib/types";

/**
 * Una línea de movimiento. Tenía un medallón de 24px con un ícono por tipo
 * —flecha arriba, candado abierto, check, octágono, etiqueta, más— delante
 * de un título que ya nombra el tipo: "Inversión confirmada", "Hito 2
 * desembolsado", "Incumplimiento declarado". Siete íconos para decir en
 * dibujo lo que la primera palabra de cada fila decía en castellano.
 *
 * Sin el medallón la lista se lee como un extracto de cuenta: título,
 * monto firmado, fecha. El signo del monto lleva la dirección y el título
 * lleva el hecho, así que nada depende del color.
 */
export function ActivityRow({
  event,
  compact = false,
  onOpen,
}: {
  event: ActivityEvent;
  compact?: boolean;
  /** Si se pasa, la fila abre la ficha de la operación. No hay rutas: es
   * la aplicación en un solo módulo — ver docs/design-system.md §6. */
  onOpen?: (slug: string) => void;
}) {
  const bad = event.kind === "default";
  const good = event.direction === "in";
  const clickable = !!onOpen && !!event.opportunitySlug;

  return (
    <button
      type="button"
      onClick={clickable ? () => onOpen!(event.opportunitySlug!) : undefined}
      className={`focusable flex w-full flex-col border-b border-border text-left transition-colors last:border-b-0 ${
        clickable ? "hover:bg-surface-soft" : "cursor-default"
      } ${compact ? "py-2" : "px-4 py-3"}`}
    >
      <div className="flex w-full items-baseline justify-between gap-3">
        <span
          className="truncate text-[12.5px] font-medium"
          style={{ color: bad ? "var(--negative)" : "var(--text-hi)" }}
        >
          {event.title}
        </span>
        {event.amount != null && (
          <span
            className="num shrink-0 text-[12px] font-semibold"
            style={{ color: good ? "var(--positive)" : "var(--text-hi)" }}
          >
            {event.direction === "out"
              ? "−"
              : event.direction === "in"
                ? "+"
                : ""}
            {formatUsdc(event.amount)}
          </span>
        )}
      </div>

      {!compact && (
        <p className="mt-0.5 text-[12px] leading-relaxed text-mid">
          {event.detail}
        </p>
      )}
      <div className="mt-0.5 text-[11.5px] text-low">{formatDate(event.at)}</div>
    </button>
  );
}
