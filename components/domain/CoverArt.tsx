import {
  Boxes,
  Building2,
  Coffee,
  Factory,
  Shirt,
  Snowflake,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CollateralKind } from "@/lib/types";

/**
 * Portada de la operación. No es una foto real —no la tenemos— pero
 * tampoco es un simple monograma: comunica qué tipo de activo respalda el
 * crédito (patrón) y a qué sector pertenece la empresa (ícono), dentro de
 * la única familia de color de marca. La variedad viene de la geometría,
 * no del matiz — así una tarjeta cuenta algo antes de leer una cifra.
 */

const SECTOR_ICON: Record<string, LucideIcon> = {
  Bebidas: Factory,
  Logística: Truck,
  Agroindustria: Coffee,
  Metalmecánica: Wrench,
  Textil: Shirt,
  "Cadena de frío": Snowflake,
};

function sectorIcon(sector: string): LucideIcon {
  return SECTOR_ICON[sector] ?? Boxes;
}

/** Patrón de fondo por clase de garantía: cada una se lee distinto. */
function Pattern({ kind }: { kind: CollateralKind }) {
  const stroke = "color-mix(in srgb, var(--brand-ink) 15%, transparent)";

  if (kind === "machinery") {
    // Tramado industrial: cruces regulares.
    return (
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id="p-machinery" width="18" height="18" patternUnits="userSpaceOnUse">
            <path d="M0 9h18M9 0v18" stroke={stroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p-machinery)" />
      </svg>
    );
  }

  if (kind === "vehicle") {
    // Líneas de velocidad: diagonales espaciadas.
    return (
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern id="p-vehicle" width="26" height="26" patternTransform="rotate(-18)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="13" x2="26" y2="13" stroke={stroke} strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#p-vehicle)" />
      </svg>
    );
  }

  // real_estate: retícula de plano arquitectónico.
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <pattern id="p-realestate" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke={stroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#p-realestate)" />
    </svg>
  );
}

export function CoverArt({
  sector,
  collateralKind,
  height = 72,
}: {
  sector: string;
  collateralKind: CollateralKind;
  height?: number;
}) {
  const Icon = sectorIcon(sector);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, backgroundColor: "var(--brand-soft)" }}
    >
      <Pattern kind={collateralKind} />
      {/* Viñeta: el patrón se apaga hacia los bordes para no competir con el texto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 78% 0%, transparent 30%, var(--brand-soft) 82%)",
        }}
      />
      <Icon
        className="absolute -bottom-2 -right-2 h-16 w-16"
        strokeWidth={1.1}
        style={{ color: "color-mix(in srgb, var(--brand-ink) 13%, transparent)" }}
      />
    </div>
  );
}
