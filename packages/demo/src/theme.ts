import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Los mismos tokens de app/globals.css. Se copian a mano y no se importan
 * porque el video no monta Tailwind ni la app: lo que no se puede evitar
 * es que sean LOS MISMOS valores. Si la marca cambia allá, cambia acá —
 * son los siete literales del archivo, y viven todos en este bloque.
 */
export const TOKENS = {
  ink: "#00272b", // --brand-ink / --text-hi (Gun Metal)
  brand: "#e0ff4f", // --brand (Chartreuse)
  brandStrong: "#6f8000", // --brand-strong
  surface: "#ffffff", // --surface
  mid: "#475467", // --text-mid
  positive: "#147a54", // --positive
} as const;

/** Chartreuse al x% sobre el fondo tinta, para bandas y pistas. */
export const brandAlpha = (alpha: number) => `rgba(224, 255, 79, ${alpha})`;
export const inkAlpha = (alpha: number) => `rgba(0, 39, 43, ${alpha})`;
/**
 * Texto secundario sobre tinta. Va en blanco rebajado y NO en chartreuse
 * rebajado: el chartreuse al 60-70% sobre el tinta vira a oliva y pierde
 * contraste — la misma razón por la que globals.css prohíbe el chartreuse
 * como color de texto. Acá el degradado se sostiene con el blanco.
 */
export const textAlpha = (alpha: number) => `rgba(255, 255, 255, ${alpha})`;

export const FONT_FAMILY = "Mona Sans, system-ui, sans-serif";

/**
 * Mona Sans es la única constante visual que el producto no pone en
 * discusión (PRODUCT.md), así que el video la carga de verdad en vez de
 * caer a la fuente del sistema. `delayRender` frena el render hasta que
 * esté: sin esto el primer frame sale con la fuente equivocada.
 */
const handle = delayRender("Mona Sans");
const font = new FontFace(
  "Mona Sans",
  `url(${staticFile("fonts/Mona-Sans.woff2")}) format("woff2")`,
  { weight: "200 900", style: "normal", display: "block" },
);

font
  .load()
  .then((loaded) => {
    document.fonts.add(loaded);
    continueRender(handle);
  })
  .catch((err) => {
    // Sin la fuente el video se ve mal, pero no rendirizar no ayuda a nadie.
    console.warn("Mona Sans no cargó, sigo con la del sistema:", err);
    continueRender(handle);
  });
