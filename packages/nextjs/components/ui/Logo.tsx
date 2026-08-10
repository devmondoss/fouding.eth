/**
 * La marca. Era el ícono `Asterisk` de lucide dentro de un cuadro
 * chartreuse, repetido a mano en cuatro archivos con tres tamaños
 * distintos — es decir, la identidad del producto la ponía una librería de
 * íconos genéricos. Ahora es un asterisco tipográfico en Mona Sans, la
 * única familia del sistema, y sale de un solo sitio.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[6px] font-bold leading-none"
      style={{
        height: size,
        width: size,
        // El asterisco de Mona Sans se asienta alto; el desplazamiento lo
        // centra ópticamente dentro del cuadro.
        paddingTop: size * 0.08,
        fontSize: size * 0.66,
        backgroundColor: "var(--brand)",
        color: "var(--brand-ink)",
      }}
    >
      ✳
    </span>
  );
}

/**
 * Marca + nombre, como aparece en las dos barras superiores.
 *
 * `suffix` es el LADO en el que estás: "Empresas" o "Inversiones". Por eso
 * solo va con sesión abierta, en las barras de cada panel — es un dato
 * sobre dónde estás parado, y antes de entrar no estás parado en ninguno.
 * Puesto en la pantalla de login decía el lado de una puerta que el
 * titular ya nombra ("Conecta tu empresa"), y dejaba al inversionista sin
 * su etiqueta equivalente en ningún lado: dos surfaces, una sola marcada.
 */
export function Wordmark({
  size = 28,
  suffix,
}: {
  size?: number;
  suffix?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={size} />
      <span className="h2 hidden text-[19px] sm:inline">Founding</span>
      {suffix && (
        <span className="ml-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
          {suffix}
        </span>
      )}
    </span>
  );
}
