import {
  MILESTONE_LABEL,
  STATUS_LABEL,
} from "@/lib/opportunity";
import type { MilestoneStatus, OpportunityStatus } from "@/lib/types";

type Tone = {
  fg: string;
  bg: string;
  bd: string;
};

/* Sin relleno de color: fondo neutro, borde y texto en el mismo tono
   pleno. Un solo color por estado, no tres variaciones del mismo. */
const TONES: Record<string, Tone> = {
  neutral: {
    fg: "var(--text-mid)",
    bg: "var(--surface)",
    bd: "var(--text-mid)",
  },
  brand: {
    fg: "var(--brand-ink)",
    bg: "var(--surface)",
    bd: "var(--brand-ink)",
  },
  positive: {
    fg: "var(--positive)",
    bg: "var(--surface)",
    bd: "var(--positive)",
  },
  warning: {
    fg: "var(--warning)",
    bg: "var(--surface)",
    bd: "var(--warning)",
  },
  negative: {
    fg: "var(--negative)",
    bg: "var(--surface)",
    bd: "var(--negative)",
  },
};

export function Pill({
  label,
  tone = "neutral",
  dot = false,
}: {
  label: string;
  tone?: keyof typeof TONES;
  dot?: boolean;
}) {
  const t = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border px-2.5 py-[3px] text-[11.5px] font-medium whitespace-nowrap"
      style={{ color: t.fg, backgroundColor: t.bg, borderColor: t.bd }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: t.fg }}
        />
      )}
      {label}
    </span>
  );
}

const STATUS_TONE: Record<OpportunityStatus, keyof typeof TONES> = {
  review: "neutral",
  funding: "brand",
  active: "positive",
  repaid: "neutral",
  defaulted: "negative",
};

export function StatusPill({ status }: { status: OpportunityStatus }) {
  return (
    <Pill label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} dot />
  );
}

const MILESTONE_TONE: Record<MilestoneStatus, keyof typeof TONES> = {
  pending: "neutral",
  submitted: "warning",
  released: "positive",
  rejected: "negative",
};

export function MilestonePill({ status }: { status: MilestoneStatus }) {
  return <Pill label={MILESTONE_LABEL[status]} tone={MILESTONE_TONE[status]} />;
}

export function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-[var(--r-pill)] border border-border bg-surface-soft px-2.5 py-[3px] text-[11.5px] text-mid whitespace-nowrap">
      {label}
    </span>
  );
}
