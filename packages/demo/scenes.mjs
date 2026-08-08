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

/** Lienzo de salida. La app está calibrada a 1366×768 (PRODUCT.md), así
 *  que se graba a ese tamaño con deviceScaleFactor 2 y se baja a 1080p:
 *  el layout es el real y el pixel llega sobrado, no interpolado. */
export const VIEWPORT = { width: 1366, height: 768 };
export const OUTPUT = { width: 1920, height: 1080 };

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
      { kind: "click", target: { css: "button.card-hover", optional: true } },
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
      { kind: "click", target: { css: "button.card-hover", optional: true } },
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
      { kind: "click", target: { css: "button.card-hover", optional: true } },
      { kind: "wait", ms: 900 },
      { kind: "click", target: { role: "tab", name: "Prelación de pagos" } },
      { kind: "wait", ms: 800 },
    ],
    // La prelación es el remate del guion: hay que poder LEERLA.
    beats: [{ kind: "wait", ms: 6400 }],
  },
  {
    id: "portafolio",
    chapter: "05 — Portafolio",
    caption: "La posición y su repago, seguidos en vivo.",
    path: "/",
    setup: [
      { kind: "click", target: { role: "button", name: "Cerrar", optional: true } },
      { kind: "wait", ms: 600 },
      { kind: "click", target: { role: "button", name: "Portafolio" } },
      { kind: "wait", ms: 900 },
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
