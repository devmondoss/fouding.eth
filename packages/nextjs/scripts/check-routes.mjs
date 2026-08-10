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
  // Las tres rutas privadas de empresa salen por la MISMA puerta que el
  // lado inversionista. Antes salían a /negocios/login: cerrar sesión
  // desde el panel de empresa y desde el catálogo dejaba a la persona en
  // dos pantallas distintas, y la de empresa además la encerraba en un
  // lado antes de preguntarle si es el suyo.
  {
    path: "/solicitar",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "el panel es privado: sin sesión sale por la puerta",
  },
  {
    // Armar un expediente es un módulo con URL propia, no un modal: si no
    // describe lo que muestra, deja de poder enlazarse y recargarse.
    path: "/solicitar/nueva",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "armar un expediente exige sesión de empresa",
  },
  {
    // Acreditar la empresa es el trámite que va antes de todo lo demás, y
    // también tiene URL propia: se envía una vez y se puede volver a ella.
    path: "/solicitar/empresa",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "acreditar la empresa exige sesión de empresa",
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
    path: "/login",
    expectUrl: "/login",
    // La puerta ya no pide una wallet, pide una travesía: es la misma
    // StandGate que sirve `/`. Ver app/login/page.tsx.
    expectText: "Soy inversionista",
    why: "puerta de entrada con URL propia, enlazable desde el QR",
  },
  {
    // `/negocios/login` se borró. Había DOS logins: la puerta, que
    // pregunta de qué lado eres, y un login de empresa que lo daba por
    // sentado — dos entradas para el mismo acto, y solo una era la salida
    // al cerrar sesión. La ruta estuvo viva, así que queda un redirect
    // permanente (next.config.ts) en vez de un 404: los marcadores y los
    // enlaces compartidos no se enteran de que borramos algo.
    path: "/negocios/login",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "el login de empresa ya no existe: hay una sola puerta",
  },
  {
    // La raíz no pinta ninguna pantalla: reparte. Servía la puerta —la
    // misma que `/login`, o sea una pantalla en dos direcciones— y, con
    // sesión, el catálogo en una URL que no lo nombraba.
    path: "/",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "la raíz solo reparte: sin sesión, a la puerta",
  },
  {
    // El catálogo del inversionista era la única superficie sin nombre:
    // `/solicitar` y `/verifier` sí lo tenían, y esta dependía de la raíz
    // para existir. Ahora se llama como su titular.
    path: "/oportunidades",
    expectUrl: "/login",
    expectText: "Soy inversionista",
    why: "el catálogo es privado: sin sesión sale por la puerta",
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
      console.log(`FAIL ${c.path.padEnd(18)} ${problems.join(" · ")}`);
    } else {
      console.log(`OK   ${c.path.padEnd(18)} -> ${url.padEnd(16)} ${c.why}`);
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
