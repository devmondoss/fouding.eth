/**
 * La marca. Era un asterisco tipográfico en un cuadro chartreuse, de
 * cuando el producto se llamaba Founding; ahora es el signo de Árbitro:
 * dos flechas que convergen sobre un núcleo hexagonal. Las dos partes que
 * pactan, y en el medio lo que resuelve entre ellas.
 *
 * **Por qué está dibujada y no es el PNG.** El original vive sobre un
 * fondo casi negro y el producto es claro: puesto sobre la barra blanca,
 * el archivo trae su propio rectángulo oscuro. Y el chartreuse de las
 * flechas mide 1.10:1 contra el blanco — invisible, que es exactamente el
 * motivo por el que el sistema ya tenía escrita la regla de usarlo solo
 * como relleno con `--brand-ink` encima (globals.css §Marca). Acá se
 * conserva la relación figura/fondo del original, invertida: el mismo
 * signo en tinta sobre el cuadro chartreuse, con el punto del centro
 * calado para que vuelva a ser el único acento claro de la marca.
 *
 * El borde escalonado de las flechas no se reproduce: a 28px es ruido, no
 * detalle. El PNG completo sigue disponible en `public/` para donde sí
 * hay tamaño — la tarjeta que se ve al compartir el enlace.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[6px]"
      style={{
        height: size,
        width: size,
        backgroundColor: "var(--brand)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.82}
        height={size * 0.82}
        fill="none"
      >
        {/* Las dos partes que pactan, apuntando al centro. */}
        <path d="M2.4 4.5 L2.4 19.5 L10.4 12 Z" fill="var(--brand-ink)" />
        <path d="M21.6 4.5 L21.6 19.5 L13.6 12 Z" fill="var(--brand-ink)" />
        {/* El núcleo, hueco y con su punto adentro. */}
        <path
          d="M15.90 12 L13.95 15.38 L10.05 15.38 L8.10 12 L10.05 8.62 L13.95 8.62 Z"
          stroke="var(--brand-ink)"
          strokeWidth="1.9"
        />
        <circle cx="12" cy="12" r="1.5" fill="var(--brand-ink)" />
        {/* El aire entre el núcleo y las flechas, dibujado como trazo del
            color del cuadro y no como hueco geométrico: así escala con el
            tamaño. Con las tres piezas pegadas —que es lo que pasaba con la
            separación fija— la marca se funde en una silueta de moño y el
            hexágono, que es lo único que no se parece a nada, desaparece. */}
        <path
          d="M17.10 12 L14.55 16.42 L9.45 16.42 L6.90 12 L9.45 7.58 L14.55 7.58 Z"
          stroke="var(--brand)"
          strokeWidth="1.6"
        />
      </svg>
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
      <span className="h2 hidden text-[19px] sm:inline">Árbitro</span>
      {suffix && (
        <span className="ml-1 rounded-[var(--r-pill)] border border-border bg-surface-soft px-2 py-[2px] text-[11px] text-mid">
          {suffix}
        </span>
      )}
    </span>
  );
}
