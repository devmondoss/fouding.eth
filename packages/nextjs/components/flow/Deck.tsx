"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OpportunityCard } from "@/components/domain/OpportunityCard";
import { usePlatform } from "@/lib/data/store";
import { formatUsdc } from "@/lib/format";
import { layersOpen, useBaseKeys } from "@/lib/keyboard";
import { STATUS_LABEL } from "@/lib/opportunity";
import type { Opportunity, OpportunityStatus } from "@/lib/types";

/** Un solo estado, un solo nombre. Los rótulos salen de STATUS_LABEL para
 *  que el filtro, la píldora de la tarjeta y la dona del portafolio no
 *  puedan volver a llamarle distinto a lo mismo — ver design-system.md §8. */
const FILTROS: { key: OpportunityStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "funding", label: STATUS_LABEL.funding },
  { key: "active", label: STATUS_LABEL.active },
  { key: "repaid", label: STATUS_LABEL.repaid },
  { key: "defaulted", label: STATUS_LABEL.defaulted },
];

/** Cuánto esperar, sin más eventos de rueda, para dar el gesto por
 *  terminado y devolver el anclaje. Bajo se siente nervioso —ancla en
 *  medio de un deslizamiento largo—; alto deja el riel suelto un rato
 *  después de soltar. */
const RUEDA_FIN_MS = 130;

/** Algunos ratones informan el desplazamiento en líneas o en páginas en
 *  vez de píxeles. Sin convertirlo, una muesca movía tres píxeles y la
 *  rueda parecía rota. */
const PX_POR_LINEA = 16;

/**
 * Catálogo. **Un riel horizontal**, el mismo en teléfono y en escritorio.
 *
 * El catálogo siempre avanzó de lado —las flechas dicen "Anterior" y
 * "Siguiente", ←/→ paginan, y `slide(dir)` desplaza en X— pero el gesto
 * del dedo y el de la rueda iban en vertical, en contra de todo eso. Ahora
 * el eje es uno solo: **la rueda empuja de costado**, el dedo desliza de
 * costado y el teclado hace lo mismo que hacía.
 *
 * Esto reemplaza dos mecánicas por una: la pila vertical del teléfono y el
 * carrusel con `AnimatePresence` del escritorio, que además remontaba las
 * tarjetas en cada página y perdía su estado.
 *
 * Cómo se mueve:
 *
 *   rueda / trackpad vertical   1:1, el riel sigue al dedo sin retardo
 *   trackpad horizontal         libre, nativo — no se intercepta
 *   ←/→                         una pantalla entera (3 tarjetas en escritorio)
 *   dedo                        deslizamiento nativo con anclaje
 *
 * No hay botones de "Anterior" y "Siguiente": duplicaban con un control lo
 * que la rueda, el dedo y el teclado ya hacen con un gesto.
 *
 * **Por qué la primera versión se sentía trabada.** Tenía tres frenos, y
 * ninguno era del navegador:
 *
 *   1. Un cierre de 320 ms que *descartaba* los eventos de rueda del
 *      medio. Mover algo y que ignore la mitad de lo que hacés es la
 *      definición de lag.
 *   2. `behavior: "smooth"` en cada muesca: una animación de duración fija
 *      que arranca de nuevo con cada evento y pelea contra la anterior.
 *   3. El anclaje obligatorio tirando hacia atrás en mitad del gesto.
 *
 * Ahora la rueda mueve `scrollLeft` directo —el riel va exactamente donde
 * va el dedo— el anclaje se suelta mientras dura el gesto y se devuelve al
 * soltar, que es cuando el navegador acomoda a la tarjeta más cercana con
 * su propia física.
 *
 * El anclaje (`snap-x`) es obligatorio en reposo: ninguna operación queda
 * cortada a medias. Y la página nunca scrollea — el que se mueve es el riel.
 */
export function Deck({ onSelect }: { onSelect: (o: Opportunity) => void }) {
  const { opportunities, usingSeedData } = usePlatform();
  const [filtro, setFiltro] = useState<OpportunityStatus | "all">("all");
  const riel = useRef<HTMLDivElement>(null);
  /** Cuál se está mirando. Sale del scroll real del riel, no de un estado
   *  paralelo, así que no puede desincronizarse de lo que hay en pantalla. */
  const [actual, setActual] = useState(0);

  const visibles = useMemo(
    () => opportunities.filter((o) => filtro === "all" || o.status === filtro),
    [opportunities, filtro],
  );

  /**
   * Ancho de una tarjeta más su separación. **Medido una vez**, no en cada
   * evento de scroll.
   *
   * Leerlo al vuelo era el segundo freno: `offsetLeft` obliga al navegador
   * a recalcular el layout, y hacerlo en cada cuadro de un desplazamiento
   * es exactamente el trabajo que no lo deja ir a 60fps. Se vuelve a medir
   * cuando cambia el tamaño del riel (rotar el teléfono, cruzar un
   * breakpoint) o cuando cambia cuántas tarjetas hay.
   *
   * Se mide del DOM y no a mano porque calcularlo obligaría a repetir acá
   * el `gap` y los breakpoints de las clases, y a mantenerlos
   * sincronizados para siempre.
   */
  const paso = useRef(1);

  useEffect(() => {
    const el = riel.current;
    if (!el) return;

    const medir = () => {
      const primera = el.firstElementChild as HTMLElement | null;
      if (!primera) return;
      const segunda = primera.nextElementSibling as HTMLElement | null;
      paso.current =
        (segunda
          ? segunda.offsetLeft - primera.offsetLeft
          : primera.offsetWidth) || 1;
    };

    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visibles.length]);

  /** Una pantalla entera — tres tarjetas en escritorio, una en teléfono.
   *  Es el paso del teclado: control grueso, y el mismo salto que tenía la
   *  paginación de antes. Acá sí va animado, porque no viene de un gesto
   *  continuo sino de una tecla suelta. */
  const porPantalla = useCallback((dir: number) => {
    const el = riel.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: dir * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
  }, []);

  // Solo cuando no hay ficha ni panel abierto encima, y nunca dentro de un
  // campo: escribir un monto no debe paginar el catálogo de atrás.
  useBaseKeys({
    onPrev: () => porPantalla(-1),
    onNext: () => porPantalla(1),
  });

  /**
   * La rueda empuja de lado, 1:1.
   *
   * Va por `addEventListener` y no por `onWheel` de React porque hace
   * falta `preventDefault()`, y React registra `wheel` como pasivo — en un
   * listener pasivo `preventDefault()` no hace nada y el navegador avisa
   * por consola.
   *
   * El anclaje se suelta mientras dura el gesto y se devuelve cuando para.
   * Con `snap-mandatory` puesto, cada asignación a `scrollLeft` era una
   * posición que el navegador corregía en el acto: el riel tiraba hacia
   * atrás en mitad del movimiento y se sentía pegajoso. Al devolverlo, el
   * navegador acomoda solo a la tarjeta más cercana, con su física y no
   * con una que tengamos que escribir.
   *
   * Tres cosas que se dejan pasar sin tocar: un desplazamiento horizontal
   * de verdad (trackpad de dos dedos, `deltaX`), Shift+rueda —que el
   * navegador ya manda al eje X— y cualquier rueda mientras haya una capa
   * abierta encima, que tiene su propio contenido que desplazar.
   */
  useEffect(() => {
    const el = riel.current;
    if (!el) return;

    let fin: ReturnType<typeof setTimeout>;

    const enPixeles = (e: WheelEvent) => {
      if (e.deltaMode === 1) return e.deltaY * PX_POR_LINEA;
      if (e.deltaMode === 2) return e.deltaY * el.clientWidth;
      return e.deltaY;
    };

    const onWheel = (e: WheelEvent) => {
      if (layersOpen() > 0) return;
      if (e.shiftKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;

      e.preventDefault();

      el.style.scrollSnapType = "none";
      el.scrollLeft += enPixeles(e);

      clearTimeout(fin);
      fin = setTimeout(() => {
        // Devolver la propiedad al valor de la clase hace que el navegador
        // vuelva a anclar por su cuenta, a la tarjeta que quedó más cerca.
        el.style.scrollSnapType = "";
      }, RUEDA_FIN_MS);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      clearTimeout(fin);
    };
  }, []);

  // Cambiar de filtro deja el riel donde estaba: con "Todas" mirando la
  // sexta y al filtrar a dos resultados, el contenedor conserva el scroll
  // y no se ve ninguna. Vuelve al principio, que es donde empieza la
  // lista nueva.
  useEffect(() => {
    riel.current?.scrollTo({ left: 0 });
    setActual(0);
  }, [filtro]);

  const total = opportunities.reduce((s, o) => s + o.raisedAmount, 0n);
  const abiertas = opportunities.filter((o) => o.status === "funding").length;

  const filtros = (
    <div className="flex gap-2 overflow-x-auto px-4 pb-1 sm:px-6 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
      {FILTROS.map((f) => {
        const on = filtro === f.key;
        return (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            aria-pressed={on}
            className="focusable shrink-0 rounded-[var(--r-pill)] border px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap transition-colors"
            style={{
              color: on ? "var(--brand-ink)" : "var(--text-mid)",
              backgroundColor: on ? "var(--brand)" : "var(--surface)",
              // El relleno chartreuse mide 1.13:1 contra el blanco de la
              // página: sin un borde de tinta, el chip seleccionado no tiene
              // silueta. El borde la da sin romper la regla de §4.
              borderColor: on ? "var(--brand-ink)" : "var(--border)",
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col lg:px-8 lg:py-6">
      {/* Encabezado. En el teléfono se achica a una línea: el riel de
          abajo necesita cada píxel de alto que se le pueda dar, y el
          titular "Oportunidades" está diciendo lo mismo que la tarjeta que
          ocupa la pantalla entera debajo. */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-0 lg:px-0 lg:pt-0">
        <div>
          <h1 className="h1 text-[19px] sm:text-[22px] lg:text-[26px]">
            Oportunidades
          </h1>
          <p className="mt-0.5 text-[12.5px] text-mid lg:mt-1 lg:text-[13px]">
            <span className="num">{abiertas}</span> rondas abiertas ·{" "}
            <span className="num">{formatUsdc(total)}</span> USDC colocados
          </p>
        </div>

        <div className="hidden lg:block">{filtros}</div>
      </div>

      {/* Si el catálogo no vino de la base, se dice. Mostrar datos
          sembrados como si fueran reales es exactamente lo que el pitch
          promete no hacer. */}
      {usingSeedData && (
        <div
          className="mx-4 mt-3 shrink-0 rounded-[var(--r-panel)] border px-3 py-2 text-[12px] sm:mx-6 lg:mx-0"
          style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Catálogo de demostración — ningún verificador publicó todavía.
        </div>
      )}

      <div className="-mx-4 mt-3 shrink-0 overflow-hidden lg:hidden">
        {filtros}
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-1 items-center px-4 sm:px-6 lg:px-0">
          <p className="text-[13.5px] text-mid">
            Ninguna operación en este estado todavía.
          </p>
        </div>
      ) : (
        <div
          ref={riel}
          // El tercer freno estaba acá: esto medía el DOM y llamaba a
          // setState en CADA evento de scroll, o sea un render de React por
          // cuadro para cambiar un número que casi siempre era el mismo.
          // Ahora usa la medida cacheada y solo avisa cuando el índice
          // cambia de verdad.
          onScroll={(e) => {
            const i = Math.round(e.currentTarget.scrollLeft / paso.current);
            setActual((previo) => (previo === i ? previo : i));
          }}
          role="group"
          aria-label="Catálogo de operaciones"
          className="mt-3 flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-4 px-4 pb-1 sm:scroll-px-6 sm:px-6 lg:mt-5 lg:gap-5 lg:scroll-px-0 lg:px-0"
        >
          {visibles.map((o) => (
            <div
              key={o.id}
              // Una por pantalla en el teléfono; tres en escritorio, que
              // es la densidad que la pantalla de trabajo ya tenía.
              className="flex w-full shrink-0 snap-start snap-always items-stretch sm:w-[calc((100%-16px)/2)] lg:w-[calc((100%-40px)/3)]"
            >
              {/* `index={0}`: el escalonado de entrada tiene sentido cuando
                  varias tarjetas aparecen juntas, y ninguno en un riel que
                  ya está montado — ahí es un retraso antes de que aparezca
                  lo único que se está mirando. */}
              <OpportunityCard o={o} index={0} onSelect={() => onSelect(o)} />
            </div>
          ))}
        </div>
      )}

      {/* Dónde estoy, y nada más.
          "Anterior" y "Siguiente" se fueron: eran dos botones para hacer
          lo que ahora hacen la rueda, el dedo y las flechas del teclado, y
          un control que solo duplica un gesto que ya existe es peso muerto
          en la barra inferior. La cifra se queda porque dice algo que
          ningún gesto dice — cuántas hay y cuánto falta.
          Sin ellos el teclado sigue entero: ←/→ mueven una pantalla
          (useBaseKeys), y como cada tarjeta es un botón, el tabulador las
          recorre y el navegador las trae a la vista solo. */}
      {visibles.length > 0 && (
        <div className="shrink-0 px-4 pb-3 pt-2 text-center sm:px-6 lg:pb-0 lg:pt-4">
          <span className="num text-[12px] text-low">
            {Math.min(actual + 1, visibles.length)} de {visibles.length}
          </span>
        </div>
      )}
    </div>
  );
}
