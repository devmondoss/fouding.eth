/**
 * Capturador: ejecuta el guion de scenes.mjs contra la app REAL y deja
 * un clip por escena en public/clips/, más un manifest con el recorte.
 *
 *   node capture/capture.mjs --login    una sola vez, a mano: inicia sesión
 *   node capture/capture.mjs            graba todas las escenas
 *   node capture/capture.mjs prelacion  regraba solo esa(s)
 *
 * Por qué un perfil persistente y no `storageState`: la sesión la maneja
 * Privy, que guarda la wallet embebida fuera de cookies+localStorage
 * (IndexedDB, iframe propio). `storageState` no se la lleva; un perfil de
 * Chromium sí. Se inicia sesión una vez con --login y todas las corridas
 * siguientes reutilizan ese perfil sin pedir correo ni código.
 *
 * Por qué un contexto nuevo por escena: Playwright escribe UN video por
 * página, y el archivo recién queda cerrado al cerrar el contexto. Un
 * contexto por escena es lo que da un archivo por escena.
 */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import {
  SCENES,
  VIEWPORT,
  OUTPUT,
  beatsDurationMs,
} from "../scenes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROFILE_DIR = path.join(ROOT, ".profile");
const CLIPS_DIR = path.join(ROOT, "public", "clips");
const RAW_DIR = path.join(ROOT, ".raw-video");
const MANIFEST = path.join(CLIPS_DIR, "manifest.json");

const BASE_URL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const HEADLESS = process.env.DEMO_HEADLESS !== "0";

/** Selector que solo existe con sesión de inversionista viva. */
const SIGNED_IN = '[aria-label="Cuenta"]';

const argv = process.argv.slice(2);
const LOGIN_MODE = argv.includes("--login");
const only = argv.filter((a) => !a.startsWith("--"));

/* ------------------------------------------------------------------ */

/** Resuelve un target del guion a un locator, en orden de preferencia. */
function locate(page, target) {
  if (target.css) return page.locator(target.css).first();
  if (target.role)
    return page
      .getByRole(target.role, { name: target.name, exact: false })
      .first();
  if (target.text) return page.getByText(target.text, { exact: false }).first();
  throw new Error(`Target sin css/role/text: ${JSON.stringify(target)}`);
}

/**
 * Ejecuta un paso. Los pasos marcados `optional` que no encuentran su
 * elemento avisan y siguen — el onboarding, por ejemplo, aparece solo la
 * primera vez y no debe tumbar la grabación cuando ya no está.
 */
async function runStep(page, step, sceneId) {
  switch (step.kind) {
    case "wait":
      await page.waitForTimeout(step.ms);
      return;
    case "key":
      await page.keyboard.press(step.key);
      return;
    case "click":
    case "hover": {
      const el = locate(page, step.target);
      try {
        await el.waitFor({ state: "visible", timeout: step.target.optional ? 1500 : 10000 });
      } catch {
        if (step.target.optional) {
          console.log(`    · ${sceneId}: opcional ausente, sigo — ${JSON.stringify(step.target)}`);
          return;
        }
        throw new Error(
          `${sceneId}: no encontré ${JSON.stringify(step.target)}. ` +
            `Revisá el selector en scenes.mjs o corré con DEMO_HEADLESS=0 para verlo.`,
        );
      }
      // Mover el mouse antes de clickear deja el hover en el video: el
      // click seco se ve como un salto sin causa.
      const box = await el.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
        await page.waitForTimeout(180);
      }
      if (step.kind === "click") await el.click();
      return;
    }
    default:
      throw new Error(`Paso desconocido: ${step.kind}`);
  }
}

async function openContext({ recordVideo }) {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless: recordVideo ? HEADLESS : false,
    viewport: VIEWPORT,
    // Se pinta a 2× y Playwright lo baja al tamaño de salida: 1080p con
    // pixel de sobra en vez de un 1366 estirado.
    deviceScaleFactor: 2,
    locale: "es-PE",
    timezoneId: "America/Lima",
    colorScheme: "light",
    reducedMotion: "no-preference",
    args: [`--window-size=${VIEWPORT.width},${VIEWPORT.height}`, "--hide-scrollbars"],
    ...(recordVideo
      ? { recordVideo: { dir: RAW_DIR, size: { width: OUTPUT.width, height: OUTPUT.height } } }
      : {}),
  });
}

/* ------------------------------------------------------------------ */

async function login() {
  console.log(`\nAbriendo ${BASE_URL} para iniciar sesión.`);
  console.log("Iniciá sesión como INVERSIONISTA en la ventana que se abrió.");
  console.log("Cuando la app cargue el catálogo, esto se cierra solo.\n");

  const ctx = await openContext({ recordVideo: false });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(BASE_URL);

  await page.waitForSelector(SIGNED_IN, { timeout: 10 * 60 * 1000 });
  // Marcar el onboarding como visto deja el perfil listo para grabar.
  await page.evaluate(() => localStorage.setItem("founding.intro", "1"));
  await page.waitForTimeout(1000);
  await ctx.close();

  console.log("Sesión guardada en .profile/ — ya podés correr `yarn capture`.");
}

async function captureScene(scene) {
  const visibleMs = beatsDurationMs(scene);
  console.log(`  ▸ ${scene.id} (${(visibleMs / 1000).toFixed(1)}s visibles)`);

  const ctx = await openContext({ recordVideo: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  // El onboarding es una capa de una sola vez; en el video sería ruido.
  await page.addInitScript(() => localStorage.setItem("founding.intro", "1"));

  const t0 = Date.now();
  await page.goto(`${BASE_URL}${scene.path}`, { waitUntil: "networkidle" });
  for (const step of scene.setup) await runStep(page, step, scene.id);

  // Todo lo anterior es andamiaje: se grabó, pero Remotion lo recorta.
  const trimMs = Date.now() - t0;

  for (const step of scene.beats) await runStep(page, step, scene.id);

  const video = page.video();
  await ctx.close(); // recién acá el .webm queda cerrado en disco
  const raw = await video.path();

  await fs.mkdir(CLIPS_DIR, { recursive: true });
  const dest = path.join(CLIPS_DIR, `${scene.id}.webm`);
  await fs.rm(dest, { force: true });
  await fs.rename(raw, dest);

  return { id: scene.id, file: `clips/${scene.id}.webm`, trimMs, visibleMs };
}

/**
 * Sin sesión la app rebota a /login y se grabaría una pantalla de acceso.
 * Mejor fallar acá con la instrucción que entregar seis clips inútiles.
 */
async function requireSession() {
  const probe = await openContext({ recordVideo: false });
  const probePage = probe.pages()[0] ?? (await probe.newPage());
  await probePage.goto(BASE_URL, { waitUntil: "networkidle" });
  const signedIn = await probePage
    .waitForSelector(SIGNED_IN, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  await probe.close();
  if (!signedIn) {
    throw new Error(
      "No hay sesión de inversionista en .profile/. Corré `yarn login` una vez y volvé.",
    );
  }
}

async function capture() {
  const wanted = only.length ? SCENES.filter((s) => only.includes(s.id)) : SCENES;
  if (!wanted.length) {
    throw new Error(`Ninguna escena coincide con: ${only.join(", ")}`);
  }

  // Las rutas públicas (la landing de negocios) no piden sesión: exigirla
  // igual obligaría a iniciar sesión para regrabar una página abierta.
  if (wanted.some((s) => !s.public)) await requireSession();

  await fs.mkdir(RAW_DIR, { recursive: true });
  console.log(`\nGrabando ${wanted.length} escena(s) contra ${BASE_URL}\n`);

  const previous = await fs
    .readFile(MANIFEST, "utf8")
    .then(JSON.parse)
    .catch(() => ({ clips: [] }));

  const byId = new Map(previous.clips.map((c) => [c.id, c]));
  for (const scene of wanted) byId.set(scene.id, await captureScene(scene));

  // El manifest conserva el orden del guion, no el orden de captura.
  const clips = SCENES.map((s) => byId.get(s.id)).filter(Boolean);
  await fs.writeFile(MANIFEST, `${JSON.stringify({ clips }, null, 2)}\n`);
  await fs.rm(RAW_DIR, { recursive: true, force: true });

  console.log(`\nListo. ${clips.length} clip(s) en public/clips/`);
  console.log("Siguiente: `yarn studio` para verlo, `yarn render` para el mp4.");
}

await (LOGIN_MODE ? login() : capture()).catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
