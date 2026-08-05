// Guardrail: body.app-shell (scroll bloqueado a propósito) SOLO debería
// aparecer en "/" — el módulo único del inversionista (ver globals.css).
// Cualquier otra ruta es un documento normal y debe poder scrollear.
// Corre contra un dev server ya levantado en localhost:3000.
//
//   yarn workspace @founding/nextjs check:scroll
//
import { chromium } from "playwright";

const BASE_URL = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

// Rutas públicas (sin login) suficientes para detectar un overflow:hidden
// que se filtró fuera del módulo del inversionista. Rutas detrás de login
// (el wizard de /solicitar, el dashboard de /) heredan el mismo <body>,
// así que si estas pasan, esas también.
const ROUTES = [
  { path: "/solicitar", expectLocked: false },
  { path: "/negocios", expectLocked: false },
  { path: "/login", expectLocked: false },
  { path: "/", expectLocked: true },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const failures = [];

  for (const { path, expectLocked } of ROUTES) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const locked = await page.evaluate(
      () => getComputedStyle(document.body).overflowY === "hidden",
    );

    const ok = locked === expectLocked;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${path.padEnd(12)} overflow-y locked=${locked} (esperado=${expectLocked})`,
    );
    if (!ok) failures.push(path);
  }

  await browser.close();

  if (failures.length) {
    console.error(
      `\n${failures.length} ruta(s) con scroll bloqueado por error: ${failures.join(", ")}`,
    );
    process.exit(1);
  }
  console.log("\nTodo OK — el scroll-lock del módulo inversionista no se filtró a otras rutas.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
