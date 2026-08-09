// Guardrail: la URL tiene que describir lo que la pantalla muestra.
// Antes /solicitar servía cuatro cosas distintas (venta, login, elección
// de rol y panel) según la sesión y un flag de localStorage, así que la
// barra de direcciones mentía. Este check recorre las rutas SIN sesión y
// verifica dónde termina cada una y con qué título.
//
//   yarn workspace @founding/nextjs check:routes
//
// Requiere un server levantado en localhost:3000 (dev o start).
import { chromium } from "playwright";

const BASE_URL = process.env.CHECK_BASE_URL ?? "http://localhost:3000";

const CASES = [
  {
    path: "/solicitar",
    expectUrl: "/negocios/login",
    expectText: "Conecta tu empresa",
    why: "el panel es privado: sin sesión manda al login de empresa",
  },
  {
    // Armar un expediente es un módulo con URL propia, no un modal: si no
    // describe lo que muestra, deja de poder enlazarse y recargarse.
    path: "/solicitar/nueva",
    expectUrl: "/negocios/login",
    expectText: "Conecta tu empresa",
    why: "armar un expediente exige sesión de empresa",
  },
  {
    path: "/rol",
    expectUrl: "/login",
    // Sin sesión, elegir rol manda a la puerta — que ES la pantalla de
    // elegir rol, solo que antes de la wallet en vez de después.
    expectText: "Soy inversionista",
    why: "elegir rol exige sesión",
  },
  {
    path: "/negocios",
    expectUrl: "/negocios",
    expectText: "Tu maquinaria vale",
    why: "página pública de venta, nunca un interstitial",
  },
  {
    path: "/negocios/login",
    expectUrl: "/negocios/login",
    expectText: "Conecta tu empresa",
    why: "login de empresa con URL propia",
  },
  {
    path: "/login",
    expectUrl: "/login",
    // La puerta ya no pide una wallet, pide una travesía: es la misma
    // StandGate que sirve `/`. Ver app/login/page.tsx.
    expectText: "Soy inversionista",
    why: "puerta de entrada con URL propia, enlazable desde el QR",
  },
];

// El título tampoco puede mentir: el layout raíz es del lado
// inversionista y se filtraba a las rutas de empresa.
const FORBIDDEN_TITLE_ON_BUSINESS = "invierte en empresas que ya facturan";

async function main() {
  const browser = await chromium.launch();
  const failures = [];

  // Precalentado. En `next dev` cada ruta se compila en su primera
  // visita, y esa compilación se comía el plazo de la aserción: el check
  // fallaba en frío y pasaba en caliente, que es la peor clase de
  // guardarraíl — el que te hace dudar del producto cuando el problema
  // es del medidor. Acá se paga la compilación sin medir nada.
  const calentar = await browser.newPage();
  for (const c of CASES) {
    await calentar
      .goto(`${BASE_URL}${c.path}`, { waitUntil: "networkidle", timeout: 120000 })
      .catch(() => {});
  }
  await calentar.close();

  for (const c of CASES) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(`${BASE_URL}${c.path}`, { waitUntil: "networkidle" });

    try {
      await page.waitForFunction(
        (t) => document.body.innerText.includes(t),
        c.expectText,
        { timeout: 20000 },
      );
    } catch {
      /* lo reporta la aserción de abajo */
    }

    const url = new URL(page.url()).pathname;
    const text = await page.textContent("body");
    const title = await page.title();

    const problems = [];
    if (url !== c.expectUrl) problems.push(`terminó en ${url}, esperado ${c.expectUrl}`);
    if (!text.includes(c.expectText)) problems.push(`no muestra "${c.expectText}"`);
    if (
      c.path.startsWith("/negocios") &&
      title.toLowerCase().includes(FORBIDDEN_TITLE_ON_BUSINESS)
    ) {
      problems.push(`título del lado inversionista en ruta de empresa: "${title}"`);
    }

    if (problems.length) {
      failures.push({ path: c.path, problems });
      console.log(`FAIL ${c.path.padEnd(16)} ${problems.join(" · ")}`);
    } else {
      console.log(`OK   ${c.path.padEnd(16)} -> ${url.padEnd(16)} ${c.why}`);
    }

    await page.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`\n${failures.length} ruta(s) donde la URL no describe la pantalla.`);
    process.exit(1);
  }
  console.log("\nTodas las URLs describen lo que muestran.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
