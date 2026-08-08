/**
 * GUION DEL DEMO — única fuente de verdad.
 *
 * Este archivo lo leen los dos lados:
 *   capture/capture.mjs  lo ejecuta contra la app real con Playwright.
 *   src/Demo.tsx         lo monta como línea de tiempo en Remotion.
 *
 * Por eso es .mjs y no .ts: Node lo corre directo y el bundler de
 * Remotion lo resuelve como ESM, sin build intermedio ni tipos que
 * mantener en dos sitios.
 *
 * Cada escena tiene dos listas de pasos:
 *   setup  se ejecuta ANTES de que empiece lo que se ve. Se graba igual
 *          (Playwright graba toda la vida de la página), pero el capturador
 *          anota en qué milisegundo terminó y Remotion recorta esa parte.
 *   beats  lo que sí se ve. Su duración total define `durationMs`.
 *
 * El orden de las escenas es el orden del video. Reordenar acá reordena
 * el video: no hay una segunda lista en ningún otro lado.
 */

export const FPS = 30;

/**
 * Viewport y lienzo son EL MISMO tamaño, a propósito.
 *
 * Playwright encaja la página en el lienzo del video escalando solo hacia
 * ABAJO: grabar el viewport calibrado de 1366×768 dentro de un lienzo de
 * 1920×1080 no lo agranda, lo pega arriba a la izquierda y rellena el
 * resto de gris. Y `deviceScaleFactor` no entra en la cuenta — el video
 * se captura en píxeles CSS. Las dos únicas salidas eran grabar a 1366 y
 * agrandar en Remotion (que ablanda las etiquetas de 13px del producto,
 * justo el texto que el jurado tiene que leer en proyector) o grabar
 * nativo a 1080p. Esto es lo segundo.
 *
 * El layout no cambia: 1920 sigue cayendo en el breakpoint `lg` que ya
 * usan Deck y la ficha, así que es la misma composición con más aire —
 * y más aire nunca puede romper el cero-scroll.
 *
 * Para grabar el viewport exacto de PRODUCT.md: DEMO_VIEWPORT=1366x768.
 * El video sale a ese tamaño, no a 1080p. El tamaño real usado queda
 * anotado en el manifest, así que la composición lo toma de ahí y no
 * puede quedar desalineada con lo que se grabó.
 *
 * Este archivo también lo empaqueta Remotion para el navegador, donde no
 * hay variables de entorno: ahí el guard cae al default y manda el
 * manifest.
 */
const [w, h] = (
  (typeof process !== "undefined" && process.env?.DEMO_VIEWPORT) || "1920x1080"
)
  .split("x")
  .map(Number);
export const VIEWPORT = { width: w, height: h };
export const OUTPUT = VIEWPORT;

/** Solape de las transiciones, en frames. */
export const TRANSITION_FRAMES = 12;

export const TITLE = {
  durationMs: 2600,
  kicker: "Arbitrum · RWA",
  title: "El orden de pago está\nescrito antes de invertir",
  subtitle: "Crédito privado tokenizado para empresas que ya facturan",
};

export const END = {
  durationMs: 3400,
  title: "Founding",
  // En pantalla el término técnico se traduce a castellano llano
  // (PRODUCT.md §Terminología): escrow → retenido en contrato,
  // waterfall → orden de pago, soulbound → no transferible.
  lines: [
    "Desembolso por hitos · Orden de pago en el contrato · Pasaporte de negocio",
    "Arbitrum Sepolia · USDC de Circle",
  ],
};

/**
 * @typedef {{kind:"wait",ms:number}
 *          |{kind:"key",key:string}
 *          |{kind:"click",target:Target}
 *          |{kind:"hover",target:Target}} Step
 * @typedef {{role?:string,name?:string,css?:string,text?:string,optional?:boolean}} Target
 */

export const SCENES = [
  {
    id: "catalogo",
    chapter: "01 — Catálogo",
    caption: "Empresas peruanas con ventas verificables y garantía real.",
    path: "/",
    setup: [
      // El onboarding se marca en localStorage; si igual aparece, se cierra.
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 700 },
    ],
    beats: [
      { kind: "wait", ms: 1400 },
      { kind: "key", key: "ArrowRight" },
      { kind: "wait", ms: 1500 },
      { kind: "key", key: "ArrowRight" },
      { kind: "wait", ms: 1600 },
    ],
  },
  {
    id: "garantia",
    chapter: "02 — La operación",
    caption: "Colateral inscrito, cobertura y castigo por tipo de activo.",
    path: "/",
    setup: [
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 600 },
      { kind: "click", target: { css: "button.card-hover" } },
      { kind: "wait", ms: 900 },
    ],
    beats: [
      { kind: "wait", ms: 1500 },
      { kind: "click", target: { role: "tab", name: "Garantía" } },
      { kind: "wait", ms: 3500 },
    ],
  },
  {
    id: "escrow",
    chapter: "03 — Desembolso por hitos",
    caption: "El capital queda retenido en el contrato, no en la empresa.",
    path: "/",
    setup: [
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 600 },
      { kind: "click", target: { css: "button.card-hover" } },
      { kind: "wait", ms: 900 },
      { kind: "click", target: { role: "tab", name: "Desembolsos" } },
      { kind: "wait", ms: 800 },
    ],
    beats: [{ kind: "wait", ms: 5200 }],
  },
  {
    id: "prelacion",
    chapter: "04 — Orden de pago",
    caption: "Si la empresa no paga, el orden de pago lo ejecuta el contrato.",
    path: "/",
    setup: [
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 600 },
      { kind: "click", target: { css: "button.card-hover" } },
      { kind: "wait", ms: 900 },
      { kind: "click", target: { role: "tab", name: "Prelación de pagos" } },
      { kind: "wait", ms: 800 },
    ],
    // La prelación es el remate del guion: hay que poder LEERLA.
    beats: [{ kind: "wait", ms: 6400 }],
  },
  {
    // Acá iba el portafolio. Se cayó del guion porque la wallet que graba
    // no tiene posiciones: la pantalla sale en estado vacío ("0 posiciones
    // en tu cuenta") debajo de un rótulo que promete seguir un repago en
    // vivo, y eso es una promesa que el cuadro no sostiene. La calificación
    // muestra dato real del mismo expediente.
    //
    // Para recuperar el portafolio: invertir con la wallet del perfil y
    // volver a poner esta escena. Regrabarla es un comando.
    id: "calificacion",
    chapter: "05 — Calificación",
    caption: "El score sale del expediente verificado, no de una promesa.",
    path: "/",
    setup: [
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 600 },
      { kind: "click", target: { css: "button.card-hover" } },
      { kind: "wait", ms: 900 },
      { kind: "click", target: { role: "tab", name: "Calificación crediticia" } },
      { kind: "wait", ms: 800 },
    ],
    beats: [{ kind: "wait", ms: 4400 }],
  },
  {
    id: "negocios",
    chapter: "06 — Del otro lado",
    caption: "La empresa arma su expediente y sigue sus desembolsos.",
    path: "/negocios",
    // Página de venta pública: se graba sin sesión. El capturador solo
    // exige el perfil con login si alguna de las escenas pedidas lo necesita.
    public: true,
    setup: [{ kind: "wait", ms: 900 }],
    beats: [{ kind: "wait", ms: 4000 }],
  },
];

/** Duración visible de una escena, en ms. */
export function beatsDurationMs(scene) {
  return scene.beats.reduce((total, step) => total + (step.ms ?? 350), 0);
}

export const msToFrames = (ms) => Math.round((ms / 1000) * FPS);

/** Duración total del video ya descontado el solape de las transiciones. */
export function totalFrames() {
  const parts = [
    TITLE.durationMs,
    ...SCENES.map(beatsDurationMs),
    END.durationMs,
  ].map(msToFrames);
  const transitions = (parts.length - 1) * TRANSITION_FRAMES;
  return parts.reduce((a, b) => a + b, 0) - transitions;
}
