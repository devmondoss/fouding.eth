/**
 * Imprime la línea de tiempo que sale del guion, sin renderizar nada.
 * El video tiene un techo duro de 45s; esto lo verifica en un segundo en
 * vez de al final de un render.
 */
import {
  beatsDurationMs,
  END,
  FPS,
  SCENES,
  TITLE,
  TRANSITION_FRAMES,
  msToFrames,
  totalFrames,
} from "../scenes.mjs";

const LIMIT_S = 45;
const rows = [
  { id: "· título", ms: TITLE.durationMs },
  ...SCENES.map((s) => ({ id: s.id, ms: beatsDurationMs(s) })),
  { id: "· cierre", ms: END.durationMs },
];

let cursorFrames = 0;
for (const [i, row] of rows.entries()) {
  const frames = msToFrames(row.ms);
  const start = cursorFrames / FPS;
  console.log(
    `${row.id.padEnd(14)} ${(row.ms / 1000).toFixed(1).padStart(5)}s   ` +
      `entra en ${start.toFixed(1).padStart(5)}s`,
  );
  cursorFrames += frames - (i === rows.length - 1 ? 0 : TRANSITION_FRAMES);
}

const frames = totalFrames();
const seconds = frames / FPS;
console.log(
  `\ntotal ${seconds.toFixed(1)}s (${frames} frames a ${FPS}fps) — ` +
    `${(rows.length - 1) * TRANSITION_FRAMES} frames comidos por las transiciones`,
);

if (seconds > LIMIT_S) {
  console.error(`\nSe pasa del techo de ${LIMIT_S}s. Recortá beats en scenes.mjs.`);
  process.exit(1);
}
console.log(`Dentro del techo de ${LIMIT_S}s, con ${(LIMIT_S - seconds).toFixed(1)}s de margen.`);
