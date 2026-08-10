import type { ReactNode } from "react";

/**
 * Vocabulario común de las pestañas de la ficha.
 *
 * Las siete estaban escritas cada una por su lado y compartían tres
 * defectos que las hacían ocupar el doble de lo necesario:
 *
 * 1. **Se envolvían en `card`** dentro de un panel que ya trae padding y
 *    fondo. Una tarjeta dentro de una tarjeta: dos bordes, dos rellenos y
 *    unos 40px de ancho perdidos en cada lado.
 * 2. **Repetían como título el nombre de la pestaña** que la persona
 *    acababa de tocar y que sigue subrayada arriba. "Garantía" debajo de
 *    "Garantía".
 * 3. **Gastaban tres líneas donde cabe una fila.** Un factor de score eran
 *    etiqueta, barra y detalle apilados; una cifra clave, una tarjeta
 *    entera con borde de color.
 *
 * Acá viven las piezas que las reemplazan. Que sean las mismas en las
 * siete no es economía de código: es que la ficha se lea como un solo
 * documento y no como siete pantallas de siete autores.
 */

/**
 * La respuesta de la pestaña en una sola línea de cifras, antes del
 * detalle. Sin cajas: las cifras se separan por aire y una regla, que es
 * suficiente y no cuesta 60px de alto.
 */
export function Encabezado({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-7 gap-y-3 border-b border-border pb-3.5">
      {children}
    </div>
  );
}

/** Una cifra del encabezado: rótulo arriba, número grande, nota opcional. */
export function Cifra({
  label,
  value,
  nota,
  color,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  nota?: ReactNode;
  color?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div
        className={`num mt-0.5 font-semibold leading-none ${
          size === "sm" ? "text-[15px]" : "text-[19px]"
        }`}
        style={{ color: color ?? "var(--text-hi)" }}
      >
        {value}
      </div>
      {nota && (
        <div className="mt-1 text-[11px] leading-snug text-low">{nota}</div>
      )}
    </div>
  );
}

/**
 * Un tramo de contenido. Separado por regla y no por tarjeta — dentro de
 * un panel que ya está enmarcado, cada borde nuevo es ruido y padding.
 */
export function Bloque({
  titulo,
  aparte,
  children,
}: {
  titulo: string;
  /** Dato al otro extremo del título: un total, un estado, un contador. */
  aparte?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 border-t border-border pt-3.5 first:mt-3.5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="label">{titulo}</h3>
        {aparte}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/**
 * Fila con barra: etiqueta, barra proporcional y valor, todo en un
 * renglón. Reemplaza el patrón de tres líneas apiladas que usaban el
 * score y el resumen.
 */
export function FilaBarra({
  etiqueta,
  valor,
  fraccion,
  color,
  detalle,
  anchoEtiqueta = 118,
}: {
  etiqueta: string;
  valor: string;
  /** 0..1 */
  fraccion: number;
  color: string;
  /** Segunda línea, solo cuando dice algo que la fila no dice. */
  detalle?: string;
  anchoEtiqueta?: number;
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2.5">
        <span
          className="shrink-0 truncate text-[12px] text-hi"
          style={{ width: anchoEtiqueta }}
          title={etiqueta}
        >
          {etiqueta}
        </span>
        <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-soft">
          <span
            className="block h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(2, Math.min(100, fraccion * 100))}%`,
              backgroundColor: color,
            }}
          />
        </span>
        <span className="num w-[54px] shrink-0 text-right text-[12px] font-medium text-hi">
          {valor}
        </span>
      </div>
      {detalle && (
        <p
          className="mt-0.5 text-[11px] leading-snug text-low"
          style={{ paddingLeft: anchoEtiqueta + 10 }}
        >
          {detalle}
        </p>
      )}
    </div>
  );
}

/**
 * Hecho con veredicto: una línea que afirma algo y otra, en color, que
 * dice si eso juega a favor o en contra. Sustituye a los recuadros de
 * color que ocupaban una tarjeta para decir dos frases.
 */
export function Hecho({
  texto,
  veredicto,
  tono,
}: {
  texto: ReactNode;
  veredicto: string;
  tono: "positive" | "warning" | "negative" | "neutral";
}) {
  const color = {
    positive: "var(--positive)",
    warning: "var(--warning)",
    negative: "var(--negative)",
    neutral: "var(--text-low)",
  }[tono];

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1">
      <span className="text-[12.5px] text-hi">{texto}</span>
      <span className="text-[11.5px] font-medium" style={{ color }}>
        {veredicto}
      </span>
    </div>
  );
}
