import {
  AlertOctagon,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Plus,
  Tag,
  Unlock,
} from "lucide-react";
import { formatDate, formatUsdc } from "@/lib/format";
import type { ActivityEvent, ActivityKind } from "@/lib/types";

const ICON: Record<ActivityKind, typeof Tag> = {
  invest: ArrowUpRight,
  release: Unlock,
  repayment: CheckCircle2,
  default: AlertOctagon,
  recovery: ArrowDownLeft,
  listing: Tag,
  deposit: Plus,
};

export function ActivityRow({
  event,
  compact = false,
  onOpen,
}: {
  event: ActivityEvent;
  compact?: boolean;
  /** Si se pasa, la fila abre la ficha de la operación. No hay rutas: es
   * la aplicación en un solo módulo — ver design-system.md §6. */
  onOpen?: (slug: string) => void;
}) {
  const Icon = ICON[event.kind];
  const bad = event.kind === "default";
  const good = event.direction === "in";
  const clickable = !!onOpen && !!event.opportunitySlug;

  return (
    <button
      type="button"
      onClick={clickable ? () => onOpen!(event.opportunitySlug!) : undefined}
      className={`flex w-full items-start gap-2.5 border-b border-border text-left transition-colors last:border-b-0 ${
        clickable ? "hover:bg-surface-soft" : "cursor-default"
      } ${compact ? "py-2" : "px-4 py-3"}`}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: bad
            ? "var(--negative)"
            : good
              ? "var(--positive)"
              : "var(--border)",
          color: bad
            ? "var(--negative)"
            : good
              ? "var(--positive)"
              : "var(--text-mid)",
        }}
      >
        <Icon className="h-3 w-3" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="truncate text-[12.5px] font-medium"
            style={{ color: bad ? "var(--negative)" : "var(--text-hi)" }}
          >
            {event.title}
          </span>
          {event.amount != null && (
            <span
              className="num shrink-0 text-[12px] font-semibold"
              style={{
                color: good ? "var(--positive)" : "var(--text-hi)",
              }}
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
        <div className="mt-0.5 text-[11.5px] text-low">
          {formatDate(event.at)}
        </div>
      </div>
    </button>
  );
}
