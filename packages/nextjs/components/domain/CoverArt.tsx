import type { CollateralKind } from "@/lib/types";

/**
 * Portada de la operación. No es una foto real —no la tenemos— y ya no es
 * un ícono de sector: era un `Factory`/`Truck`/`Coffee` de librería sobre un
 * wash de marca, que es exactamente la estampa de "generado". Queda la
 * geometría, que sí dice algo: el patrón nombra la clase de activo que
 * respalda el crédito, y el sector solo lo inclina, para que dos tarjetas
 * con la misma garantía no salgan idénticas en la misma página.
 */

/** Ángulo estable a partir del sector: mismo sector, misma inclinación. */
function sectorTilt(sector: string): number {
  let h = 0;
  for (let i = 0; i < sector.length; i++) h = (h * 31 + sector.charCodeAt(i)) % 360;
  // −24°..24°, sin pasar por el 0 exacto para que la inclinación se note.
  return (h % 41) - 20 + (h % 2 === 0 ? 4 : -4);
}

/** Patrón de fondo por clase de garantía: cada una se lee distinto. */
function Pattern({ kind, tilt }: { kind: CollateralKind; tilt: number }) {
  const stroke = "color-mix(in srgb, var(--brand-ink) 15%, transparent)";
  // El id lleva la inclinación porque dos <pattern> con el mismo id en el
  // documento colapsan en uno: sin esto todas las tarjetas del mismo tipo
  // heredarían el ángulo de la primera que se montó.
  const id = `p-${kind}-${Math.round(tilt) + 90}`;

  if (kind === "machinery") {
    // Tramado industrial: cruces regulares.
    return (
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern
            id={id}
            width="18"
            height="18"
            patternTransform={`rotate(${tilt})`}
            patternUnits="userSpaceOnUse"
          >
            <path d="M0 9h18M9 0v18" stroke={stroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    );
  }

  if (kind === "vehicle") {
    // Líneas de velocidad: diagonales espaciadas.
    return (
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <pattern
            id={id}
            width="26"
            height="26"
            patternTransform={`rotate(${tilt - 18})`}
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="13" x2="26" y2="13" stroke={stroke} strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    );
  }

  // real_estate: retícula de plano arquitectónico.
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <pattern
          id={id}
          width="24"
          height="24"
          patternTransform={`rotate(${tilt})`}
          patternUnits="userSpaceOnUse"
        >
          <path d="M24 0H0V24" fill="none" stroke={stroke} strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
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
  return (
    <div
      className="relative overflow-hidden"
      style={{ height, backgroundColor: "var(--brand-soft)" }}
    >
      <Pattern kind={collateralKind} tilt={sectorTilt(sector)} />
      {/* Viñeta: el patrón se apaga hacia los bordes para no competir con el texto */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 78% 0%, transparent 30%, var(--brand-soft) 82%)",
        }}
      />
    </div>
  );
}
