# Plan de construcción — Prototipo navegable

**Objetivo:** una plataforma que se ve y se navega como el producto final, con datos simulados. Sirve para validar la idea, la UX y el pitch **antes** de escribir un solo contrato.

**Lo que NO es:** no hay blockchain, no hay wallet, no hay base de datos, no hay autenticación real. Todo eso llega después y sin reescribir las pantallas.

**Estado: fases 0 a 4 completas.** El prototipo corre en `localhost` con el flujo del inversionista de punta a punta.

---

## La regla que hizo que esto no fuera trabajo desechable

Los **tipos de dominio y la capa de acceso a datos** se definieron una sola vez, con la forma que van a tener los contratos.

```
Pantallas  →  packages/nextjs/lib/data/store.tsx (interfaz)  →  seed.ts   ← hoy
                                             →  onchain/  ← después
```

Dos decisiones que se pagaron solas:

- **Montos en `bigint`, micro-USDC.** `1_500_000_000n` = 1,500 USDC, exactamente lo que devolverá el contrato.
- **Tasas en basis points.** APY 14.5% → `1450`, igual que en Solidity.

Y una tercera que no estaba en el plan original pero resultó ser la más rentable: **los componentes nunca leen colores literales, solo tokens CSS**. El lenguaje visual cambió cuatro veces (oscuro cromático → claro cromático → monocromo mono → marketplace) y ninguna vez hubo que reescribir la lógica de las pantallas.

---

## Alcance del producto

**Tres lados, con URL propia cada uno.** El documento decía "solo el lado del inversionista"; dejó de ser cierto en agosto de 2026.

| Superficie | Ruta | Estado |
| --- | --- | --- |
| Inversionista | `/oportunidades` | Catálogo, ficha, portafolio, cobro |
| Empresa | `/negocios`, `/solicitar` | Panel de solicitudes y envío de expedientes |
| Verificador | `/verifier` | Decide expedientes, publica oportunidades y aprueba acceso de inversionistas |

`/login` es la única puerta de las dos superficies y `/` no es una pantalla: mira la sesión y reparte hacia la que corresponde.

Cada wallet declara su rol UNA vez en `/rol` y ya no cambia: el KYC de la persona y el KYB de la empresa son verificaciones distintas y no pueden compartir el mismo estado. Quien intenta entrar por el lado que no es el suyo recibe una pantalla que se lo dice, no un redirect callado.

Lo que sigue sin interfaz: declarar incumplimiento, registrar repagos y ejecutar el recupero. El contrato ya los implementa; solo se alcanzan desde `packages/stylus/scripts/protocol_e2e.ts`.

---

## Stack del prototipo

```
Next.js 16 (App Router) + TypeScript
Tailwind v4  +  tokens de design-system.md
Inter + IBM Plex Mono (next/font)
lucide-react
Yarn workspaces + Scaffold-Stylus
```

Nada de wagmi, viem, Prisma ni Supabase todavía.

---

## Estructura de archivos

```
packages/nextjs/app/
  layout.tsx                 fuentes + PlatformProvider + AppShell
  page.tsx                   CATÁLOGO — la aplicación entera como módulos
  oportunidades/[slug]/      ficha de producto
  portafolio/                posiciones y movimientos
  acceso/                    verificación, a pantalla completa
packages/nextjs/components/
  chrome/    AppShell (marco + Container + SectionHead), TopNav
  ui/        Button, Pill, ProgressBar, Stat, Table, Field, Modal
  domain/    OpportunityCard, CollateralPanel, MilestoneTimeline,
             WaterfallPanel, ScorePanel, PassportPanel, InvestPanel,
             ActivityRow, ScoreBadge
packages/nextjs/lib/
  types.ts                   modelo de dominio
  format.ts                  formateo de montos, tasas y fechas
  opportunity.ts             selectores derivados
  underwriting.ts            scoring + waterfall (funciones puras)
  data/
    seed.ts                  6 operaciones + posiciones + actividad
    store.tsx                adaptador mock con estado en memoria
packages/nextjs/app/globals.css  tokens + utilidades
```

---

## Fases

### Fase 0 — Esqueleto y sistema visual ✅
Proyecto Next.js, tokens en `globals.css`, primitivas de superficie.

### Fase 1 — Primitivas de UI ✅
`Button`, `Pill`, `ProgressBar`, `Stat`, `Table`, `Field`, `Modal`.

> La ruta `/ui` (kitchen sink) existió durante el desarrollo y se eliminó al cerrar el lenguaje visual. Si se retoma la iteración de componentes, conviene recrearla.

### Fase 2 — Modelo de dominio y datos mock ✅
`types.ts` con el modelo completo, `underwriting.ts` con score y waterfall como **funciones puras y deterministas** —pensadas para portarse al contrato casi tal cual—, y seed con 6 operaciones que cubren los cinco estados.

**El deal en default está construido para enseñar la tesis:** cobertura de 0.95x, garantía sin inscribir, arrendamiento financiero previo, aporte propio de 15% e historial con 4 pagos tardíos. Cuando alguien pregunte "¿y si sale mal?", ese caso responde solo.

### Fase 3 — Pantallas ✅
Catálogo con filtros por estado y sector, ficha de producto, portafolio y onboarding.

### Fase 4 — Flujos simulados ✅
- **Invertir** → valida ticket mínimo y saldo, descuenta, crea la posición, registra el movimiento y avanza la barra de recaudación.
- **Vender posición** → publica y retira del libro de órdenes.
- **Recupero tras incumplimiento** → visible en el portafolio y en los movimientos, con el waterfall ya ejecutado sobre los 78,400 USDC recuperados.

### Fase 5 — Fuera del prototipo ⏳
Adaptador `onchain/` con viem, contratos en Arbitrum Sepolia, Postgres para lo sensible y whitelist real. **Las pantallas no se reescriben.**

---

## Qué es real y qué sigue simulado

Conviene tenerlo clarísimo antes de una demo, y decirlo en el pitch.

**Real, de punta a punta:**

- **Login y wallet.** Privy con wallet embebida; el correo crea la cuenta de verdad.
- **Expediente de la empresa.** Se sube un archivo, se guarda en Postgres (Neon) y su `keccak256` queda como `legalPackHash`.
- **Decisión del verificador.** Aprobar emite el `CompanyPassportSBT` en cadena, firmado desde el servidor, esperando el receipt antes de marcarlo aprobado.
- **Publicación de oportunidades.** El verificador convierte un expediente aprobado en una oportunidad del catálogo; el catálogo sale de Postgres, no de `seed.ts`.
- **Acceso del inversionista.** La solicitud guarda la identidad declarada fuera de cadena y ancla su hash en `AccessRegistry`; compliance aprueba o rechaza desde `/verifier`, y eso habilita la wallet en cadena.
- **Invertir y cobrar.** `approve` + `fund` contra el `CreditVault`, y `claim` desde el portafolio.

**Todavía simulado:**

- **Saldo, posiciones y actividad del portafolio** viven en `localStorage` por wallet. La actividad sí se reemplaza por la real cuando el indexer tiene filas para esa wallet.
- **El catálogo cae al seed** si Postgres no responde — y cuando eso pasa la pantalla lo dice (`usingSeedData`), no lo disimula.
- **Los hitos son de solo lectura.** El contrato todavía desembolsa el 100% en `activate()`, así que no hay tramos que aprobar.
- **El waterfall** se calcula en `underwriting.ts`, no en el contrato.
- **El libro de órdenes está a medias:** se publica una posición en venta, pero no hay lado comprador ni contrato que liquide.
- **Un solo vault para todas las oportunidades.** `useCreditVault` apunta a un deployment fijo; falta el mapeo por oportunidad (columna `vault_address`, ya en el schema).
- **No hay on/off-ramp.** Nada convierte PEN a USDC ni al revés.

---

## Siguiente paso

Dos caminos, en este orden de preferencia:

1. **Cerrar el lado comprador del libro de órdenes**, que completa el argumento de liquidez del pitch.
2. **Empezar los contratos** usando `underwriting.ts` como especificación ejecutable: el score y el waterfall ya están escritos como funciones puras precisamente para eso.
